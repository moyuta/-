import { ensureDefined, ensureNotNull } from '../helpers/assertions';
import { Delegate } from '../helpers/delegate';
import { IDestroyable } from '../helpers/idestroyable';
import { ISubscription } from '../helpers/isubscription';
import { DeepPartial } from '../helpers/strict-type-checks';

import { ChartModel, ChartOptions } from '../model/chart-model';
import { Coordinate } from '../model/coordinate';
import { InvalidateMask, InvalidationLevel } from '../model/invalidate-mask';
import { Point } from '../model/point';
import { Series } from '../model/series';
import { TimePoint, TimePointIndex } from '../model/time-data';

import { Size } from './canvas-utils';
import { PaneSeparator, SEPARATOR_HEIGHT } from './pane-separator';
import { PaneWidget } from './pane-widget';
import { TimeAxisWidget } from './time-axis-widget';

export interface MouseEventParamsImpl {
	time?: TimePoint;
	point?: Point;
	seriesPrices: Map<Series, number>;
}

export class ChartWidget implements IDestroyable {
	private readonly _options: ChartOptions;
	private _paneWidgets: PaneWidget[] = [];
	private _paneSeparators: PaneSeparator[] = [];
	private readonly _model: ChartModel;
	private _drawRafId: number = 0;
	private readonly _priceAxisWidthChanged: Delegate<number> = new Delegate();
	private _height: number = 0;
	private _width: number = 0;
	private _priceAxisWidth: number = 0;
	private _element: HTMLElement;
	private readonly _tableElement: HTMLElement;
	private _timeAxisWidget: TimeAxisWidget;
	private _invalidateMask: InvalidateMask | null = null;
	private _drawPlanned: boolean = false;
	private _clicked: Delegate<MouseEventParamsImpl> = new Delegate();
	private _crosshairMoved: Delegate<MouseEventParamsImpl> = new Delegate();
	private _onWheelBound: (event: WheelEvent) => void;

	public constructor(container: HTMLElement, options: ChartOptions) {
		this._options = options;

		this._element = document.createElement('div');
		this._element.style.overflow = 'hidden';
		this._element.style.width = '100%';
		this._element.style.height = '100%';

		this._tableElement = document.createElement('table');
		this._tableElement.setAttribute('cellspacing', '0');
		this._element.appendChild(this._tableElement);

		this._onWheelBound = this._onMousewheel.bind(this);
		this._element.addEventListener('wheel', this._onWheelBound);

		this._model = new ChartModel(
			this._invalidateHandler.bind(this),
			this._options
		);
		this.model().crosshairMoved().subscribe(this._onPaneWidgetCrosshairMoved.bind(this), this);

		this._timeAxisWidget = new TimeAxisWidget(this);
		this._tableElement.appendChild(this._timeAxisWidget.getElement());

		let width = this._options.width;
		let height = this._options.height;

		if (width === 0 && height === 0) {
			const containerRect = container.getBoundingClientRect();
			width = containerRect.width;
			height = containerRect.height;
		}

		width = Math.max(70, width);
		height = Math.max(50, height);

		// BEWARE: resize must be called BEFORE _syncGuiWithModel (in constructor only)
		// or after but with adjustSize to properly update time scale
		this.resize(height, width);

		this._syncGuiWithModel();

		container.appendChild(this._element);
		this._updateTimeAxisVisibility();
		this._model.timeScale().optionsApplied().subscribe(
			() => {
				this._updateTimeAxisVisibility();
				this.adjustSize();
			},
			this
		);
	}

	public model(): ChartModel {
		return this._model;
	}

	public options(): ChartOptions {
		return this._options;
	}

	public paneWidgets(): PaneWidget[] {
		return this._paneWidgets;
	}

	public destroy(): void {
		this._element.removeEventListener('wheel', this._onWheelBound);
		if (this._drawRafId !== 0) {
			window.cancelAnimationFrame(this._drawRafId);
		}

		this._model.crosshairMoved().unsubscribeAll(this);
		this._model.timeScale().optionsApplied().unsubscribeAll(this);
		this._model.destroy();

		for (const paneWidget of this._paneWidgets) {
			this._tableElement.removeChild(paneWidget.getElement());
			paneWidget.clicked().unsubscribeAll(this);
			paneWidget.destroy();
		}
		this._paneWidgets = [];

		for (const paneSeparator of this._paneSeparators) {
			this._destroySeparator(paneSeparator);
		}
		this._paneSeparators = [];

		ensureNotNull(this._timeAxisWidget).destroy();

		if (this._element.parentElement !== null) {
			this._element.parentElement.removeChild(this._element);
		}

		this._crosshairMoved.destroy();
		this._clicked.destroy();

		delete this._element;
	}

	public resize(height: number, width: number, forceRepaint: boolean = false): void {
		if (this._height === height && this._width === width) {
			return;
		}

		this._height = height;
		this._width = width;

		const heightStr = height + 'px';
		const widthStr = width + 'px';

		ensureNotNull(this._element).style.height = heightStr;
		ensureNotNull(this._element).style.width = widthStr;

		this._tableElement.style.height = heightStr;
		this._tableElement.style.width = widthStr;

		if (forceRepaint) {
			this._drawImpl(new InvalidateMask(InvalidationLevel.Full));
		} else {
			this._model.fullUpdate();
		}
	}

	public paint(invalidateMask?: InvalidateMask): void {
		if (invalidateMask === undefined) {
			invalidateMask = new InvalidateMask(InvalidationLevel.Full);
		}

		for (let i = 0; i < this._paneWidgets.length; i++) {
			this._paneWidgets[i].paint(invalidateMask.invalidateForPane(i).level);
		}

		this._timeAxisWidget.paint(invalidateMask.fullInvalidation());
	}

	public adjustSize(): void {
		this._adjustSizeImpl();
		this._model.fullUpdate();
	}

	public applyOptions(options: DeepPartial<ChartOptions>): void {
		this._model.applyOptions(options);
		this._paneWidgets[0].updateBranding();
		this._updateTimeAxisVisibility();

		const width = options.width || this._width;
		const height = options.height || this._height;

		this.resize(height, width);
	}

	public clicked(): ISubscription<MouseEventParamsImpl> {
		return this._clicked;
	}

	public crosshairMoved(): ISubscription<MouseEventParamsImpl> {
		return this._crosshairMoved;
	}

	public disableBranding(): void {
		this._paneWidgets[0].disableBranding();
	}

	private _adjustSizeImpl(): void {
		let totalStretch = 0;
		let priceAxisWidth = 0;

		for (const paneWidget of this._paneWidgets) {
			if (this._options.priceScale.position !== 'none') {
				priceAxisWidth = Math.max(priceAxisWidth, ensureNotNull(paneWidget.priceAxisWidget()).optimalWidth());
			}

			totalStretch += paneWidget.stretchFactor();
		}

		const width = this._width;
		const height = this._height;

		const paneWidth = Math.max(width - priceAxisWidth, 0);

		const separatorCount = this._paneSeparators.length;
		const separatorHeight = SEPARATOR_HEIGHT;
		const separatorsHeight = separatorHeight * separatorCount;
		const timeAxisHeight = this._options.timeScale.visible ? this._timeAxisWidget.optimalHeight() : 0;
		const otherWidgetHeight = separatorsHeight + timeAxisHeight;
		const totalPaneHeight = height < otherWidgetHeight ? 0 : height - otherWidgetHeight;
		const stretchPixels = totalPaneHeight / totalStretch;

		let accumulatedHeight = 0;
		for (let paneIndex = 0; paneIndex < this._paneWidgets.length; ++paneIndex) {
			const paneWidget = this._paneWidgets[paneIndex];
			paneWidget.setState(this._model.panes()[paneIndex]);

			let paneHeight = 0;
			let calculatePaneHeight = 0;

			if (paneIndex === this._paneWidgets.length - 1) {
				calculatePaneHeight = totalPaneHeight - accumulatedHeight;
			} else {
				calculatePaneHeight = Math.round(paneWidget.stretchFactor() * stretchPixels);
			}

			paneHeight = Math.max(calculatePaneHeight, 2);

			accumulatedHeight += paneHeight;

			paneWidget.setSize(new Size(paneWidth, paneHeight));
			if (this._options.priceScale.position !== 'none') {
				paneWidget.setPriceAxisSize(priceAxisWidth);
			}

			if (paneWidget.state()) {
				this._model.setPaneHeight(paneWidget.state(), paneHeight);
			}
		}

		this._timeAxisWidget.setSizes(
			new Size(paneWidth, timeAxisHeight),
			priceAxisWidth
		);

		this._model.setWidth(paneWidth);
		if (this._priceAxisWidth !== priceAxisWidth) {
			this._priceAxisWidth = priceAxisWidth;
			this._priceAxisWidthChanged.fire(priceAxisWidth);
		}
	}

	private _onMousewheel(event: WheelEvent): void {
		let deltaX = event.deltaX / 100;
		let deltaY = -(event.deltaY / 100);

		if ((deltaX === 0 || !this._options.handleScroll.mouseWheel) &&
			(deltaY === 0 || !this._options.handleScale.mouseWheel)) {
			return;
		}

		event.preventDefault();

		switch (event.deltaMode) {
			case event.DOM_DELTA_PAGE:
				// one screen at time scroll mode
				deltaX *= 120;
				deltaY *= 120;
				break;

			case event.DOM_DELTA_LINE:
				// one line at time scroll mode
				deltaX *= 32;
				deltaY *= 32;
				break;
		}

		if (deltaY !== 0 && this._options.handleScale.mouseWheel) {
			const zoomScale = Math.sign(deltaY) * Math.min(1, Math.abs(deltaY));
			const scrollPosition = event.clientX - this._element.getBoundingClientRect().left;
			this.model().zoomTime(scrollPosition as Coordinate, zoomScale);
		}

		if (deltaX !== 0 && this._options.handleScroll.mouseWheel) {
			this.model().scrollChart(deltaX * -80 as Coordinate); // 80 is a made up coefficient, and minus is for the "natural" scroll
		}
	}

	private _drawImpl(invalidateMask: InvalidateMask): void {
		const invalidationType = invalidateMask.fullInvalidation();

		if (invalidationType === InvalidationLevel.Full) {
			this._updateGui();
			if (invalidateMask.getFitContent()) {
				this._model.timeScale().fitContent();
			}

			const panes = this._model.panes();
			for (let i = 0; i < panes.length; i++) {
				if (invalidateMask.invalidateForPane(i).autoScale) {
					panes[i].momentaryAutoScale();
				}
			}

			this._timeAxisWidget.update();
			for (let i = 0; i < this._paneWidgets.length; i++) {
				this._paneWidgets[i].setState(this._model.panes()[i]);
			}
		} else if (invalidationType === InvalidationLevel.Light) {
			if (invalidateMask.getFitContent()) {
				this._model.timeScale().fitContent();
			}
			this._timeAxisWidget.update();
		}

		this.paint(invalidateMask);
	}

	private _invalidateHandler(invalidateMask: InvalidateMask): void {
		if (this._invalidateMask !== null) {
			this._invalidateMask.merge(invalidateMask);
		} else {
			this._invalidateMask = invalidateMask;
		}

		if (!this._drawPlanned) {
			this._drawPlanned = true;
			this._drawRafId = window.requestAnimationFrame(() => {
				this._drawPlanned = false;
				this._drawRafId = 0;

				if (this._invalidateMask !== null) {
					this._drawImpl(this._invalidateMask);
					this._invalidateMask = null;
				}
			});
		}
	}

	private _updateGui(): void {
		this._syncGuiWithModel();
	}

	private _destroySeparator(separator: PaneSeparator): void {
		this._tableElement.removeChild(separator.getElement());
		separator.destroy();
	}

	private _syncGuiWithModel(): void {
		const panes = this._model.panes();
		const targetPaneWidgetsCount = panes.length;
		const actualPaneWidgetsCount = this._paneWidgets.length;

		// Remove (if needed) pane widgets and separators
		for (let i = targetPaneWidgetsCount; i < actualPaneWidgetsCount; i++) {
			const paneWidget = ensureDefined(this._paneWidgets.pop());
			this._tableElement.removeChild(paneWidget.getElement());
			paneWidget.clicked().unsubscribeAll(this);
			paneWidget.destroy();

			const paneSeparator = this._paneSeparators.pop();
			if (paneSeparator !== undefined) {
				this._destroySeparator(paneSeparator);
			}
		}

		// Create (if needed) new pane widgets and separators
		for (let i = actualPaneWidgetsCount; i < targetPaneWidgetsCount; i++) {
			const paneWidget = new PaneWidget(this, panes[i]);
			paneWidget.clicked().subscribe(this._onPaneWidgetClicked.bind(this), this);

			this._paneWidgets.push(paneWidget);

			// create and insert separator
			if (i > 1) {
				const paneSeparator = new PaneSeparator(this, i - 1, i, true);
				this._paneSeparators.push(paneSeparator);
				this._tableElement.insertBefore(paneSeparator.getElement(), this._timeAxisWidget.getElement());
			}

			// insert paneWidget
			this._tableElement.insertBefore(paneWidget.getElement(), this._timeAxisWidget.getElement());
		}

		for (let i = 0; i < targetPaneWidgetsCount; i++) {
			const state = panes[i];
			const paneWidget = this._paneWidgets[i];
			if (paneWidget.state() !== state) {
				paneWidget.setState(state);
			} else {
				paneWidget.updatePriceAxisWidget();
			}
		}

		this._updateTimeAxisVisibility();
		this._adjustSizeImpl();
	}

	private _getMouseEventParamsImpl(time: TimePointIndex | null, point: Point | null): MouseEventParamsImpl {
		const seriesPrices = new Map<Series, number>();
		if (time !== null) {
			const serieses = this._model.serieses();
			serieses.forEach((s: Series) => {
				// TODO: replace with search left
				const prices = s.data().valueAt(time);
				if (prices !== null) {
					const price = s.barFunction()(prices.value);
					seriesPrices.set(s, price);
				}
			});

		}
		let clientTime: TimePoint | undefined;
		if (time !== null) {
			const timePoint = this._model.timeScale().indexToUserTime(time);
			if (timePoint !== null) {
				clientTime = timePoint;
			}
		}

		return {
			time: clientTime,
			point: point || undefined,
			seriesPrices,
		};
	}

	private _onPaneWidgetClicked(time: TimePointIndex | null, point: Point): void {
		const param = this._getMouseEventParamsImpl(time, point);
		this._clicked.fire(param);
	}

	private _onPaneWidgetCrosshairMoved(time: TimePointIndex | null, point: Point | null): void {
		const param = this._getMouseEventParamsImpl(time, point);
		this._crosshairMoved.fire(param);
	}

	private _updateTimeAxisVisibility(): void {
		const display = this._options.timeScale.visible ? '' : 'none';
		this._timeAxisWidget.getElement().style.display = display;
	}
}
