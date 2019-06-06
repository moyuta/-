import { ensureNotNull } from '../../helpers/assertions';

import { ChartModel } from '../../model/chart-model';
import { PriceScale } from '../../model/price-scale';
import { Series } from '../../model/series';
import { SeriesType } from '../../model/series-options';
import { SeriesItemsIndexesRange, TimedValue, visibleTimedValues } from '../../model/time-data';
import { TimeScale } from '../../model/time-scale';
import { IPaneRenderer } from '../../renderers/ipane-renderer';

import { IUpdatablePaneView, UpdateType } from './iupdatable-pane-view';

export abstract class SeriesPaneViewBase<TSeriesType extends SeriesType, ItemType extends TimedValue> implements IUpdatablePaneView {
	protected _series: Series<TSeriesType>;
	protected _model: ChartModel;
	protected _invalidated: boolean = true;
	protected _dataInvalidated: boolean = true;
	protected _items: ItemType[] = [];
	protected _itemsVisibleRange: SeriesItemsIndexesRange | null = null;

	public constructor(series: Series<TSeriesType>, model: ChartModel) {
		this._series = series;
		this._model = model;
	}

	public update(updateType?: UpdateType): void {
		this._invalidated = true;
		if (updateType === 'data') {
			this._dataInvalidated = true;
		}
	}

	public abstract renderer(height: number, width: number): IPaneRenderer;

	protected _makeValid(): void {
		if (this._dataInvalidated) {
			this._fillRawPoints();
			this._dataInvalidated = false;
		}

		if (this._invalidated) {
			this._updatePoints();
			this._invalidated = false;
		}
	}

	protected abstract _fillRawPoints(): void;

	protected abstract _convertToCoordinates(priceScale: PriceScale, timeScale: TimeScale, firstValue: number): void;

	protected _updatePoints(): void {
		const priceScale = this._series.priceScale();
		const timeScale = this._model.timeScale();

		if (timeScale.isEmpty() || priceScale.isEmpty()) {
			this._itemsVisibleRange = null;
			return;
		}

		const visibleBars = timeScale.visibleBars();
		if (visibleBars === null) {
			this._itemsVisibleRange = null;
			return;
		}

		if (this._series.data().bars().size() === 0) {
			this._itemsVisibleRange = null;
			return;
		}

		this._itemsVisibleRange = visibleTimedValues(this._items, visibleBars);

		const firstValue = ensureNotNull(this._series.firstValue());

		this._convertToCoordinates(priceScale, timeScale, firstValue);
	}
}
