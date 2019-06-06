import {
	AreaStyleOptions,
	BarStyleOptions,
	CandleStyleOptions,
	HistogramStyleOptions,
	LineStyleOptions,
	SeriesOptionsCommon,
} from '../../model/series-options';
import { LineStyle } from '../../renderers/draw-line';

export const candleStyleDefaults: CandleStyleOptions = {
	upColor: '#26a69a',
	downColor: '#ef5350',
	wickVisible: true,
	borderVisible: true,
	borderColor: '#378658',
	borderUpColor: '#26a69a',
	borderDownColor: '#ef5350',
	wickColor: '#737375',
	wickUpColor: '#26a69a',
	wickDownColor: '#ef5350',
};

export const barStyleDefaults: BarStyleOptions = {
	upColor: '#26a69a',
	downColor: '#ef5350',
	openVisible: true,
	thinBars: true,
};

export const lineStyleDefaults: LineStyleOptions = {
	color: '#2196f3',
	lineStyle: LineStyle.Solid,
	lineWidth: 3,
	crosshairMarkerVisible: true,
	crosshairMarkerRadius: 4,
};

export const areaStyleDefaults: AreaStyleOptions = {
	topColor: 'rgba( 46, 220, 135, 0.4)',
	bottomColor: 'rgba( 40, 221, 100, 0)',
	lineColor: '#33D778',
	lineStyle: LineStyle.Solid,
	lineWidth: 3,
	crosshairMarkerVisible: true,
	crosshairMarkerRadius: 4,
};

export const histogramStyleDefaults: HistogramStyleOptions = {
	color: '#26a69a',
	base: 0,
	lineWidth: 2,
};

export const seriesOptionsDefaults: SeriesOptionsCommon = {
	title: '',
	lastValueVisible: true,
	priceLineVisible: true,
	priceLineWidth: 1,
	priceLineColor: '',
	baseLineColor: '#B2B5BE',
	priceFormat: {
		type: 'price',
		precision: 2,
		minMove: 0.01,
	},
};
