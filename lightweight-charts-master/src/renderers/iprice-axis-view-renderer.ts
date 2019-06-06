import { TextWidthCache } from '../model/text-width-cache';
import { LineStyle, LineWidth } from '../renderers/draw-line';

export interface PriceAxisViewRendererCommonData {
	activeBackground?: string;
	background: string;
	borderColor?: string;
	color: string;
	coordinate: number;
	floatCoordinate?: number;
	fixedCoordinate?: number;
}

export interface PriceAxisViewRendererData {
	visible: boolean;
	text: string;
	tickVisible: boolean;
	borderVisible: boolean;
	lineWidth?: LineWidth;
	lineStyle: LineStyle;
}

export interface PriceAxisViewRendererOptions {
	baselineOffset: number;
	borderSize: number;
	offsetSize: number;
	font: string;
	fontFamily: string;
	color: string;
	fontSize: number;
	paddingBottom: number;
	paddingInner: number;
	paddingOuter: number;
	paddingTop: number;
	tickLength: number;
}

export interface IPriceAxisViewRenderer {
	draw(
		ctx: CanvasRenderingContext2D,
		rendererOptions: PriceAxisViewRendererOptions,
		textWidthCache: TextWidthCache,
		width: number,
		align: 'left' | 'right'
	): void;

	height(rendererOptions: PriceAxisViewRendererOptions, useSecondLine: boolean): number;
	setData(data: PriceAxisViewRendererData, commonData: PriceAxisViewRendererCommonData): void;
}

export type IPriceAxisViewRendererConstructor = new(data: PriceAxisViewRendererData, commonData: PriceAxisViewRendererCommonData) => IPriceAxisViewRenderer;
