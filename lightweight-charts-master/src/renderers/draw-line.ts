import { Coordinate } from '../model/coordinate';

export type LineWidth = 1 | 2 | 3 | 4;

export const enum LineType {
	Simple,
	WithSteps,
}

export interface LinePoint {
	x: Coordinate;
	y: Coordinate;
}

export const enum LineStyle {
	Solid = 0,
	Dotted = 1,
	Dashed = 2,
	LargeDashed = 3,
	SparseDotted = 4,
}

export function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lineStyle: LineStyle): void {
	if (!isFinite(x1) || !isFinite(x2) || !isFinite(y1) || !isFinite(y2)) {
		return;
	}

	ctx.save();

	setLineStyle(ctx, lineStyle);

	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();

	ctx.restore();
}

export function setLineStyle(ctx: CanvasRenderingContext2D, style: LineStyle): void {
	const dashPatterns = {
		[LineStyle.Solid]: [],
		[LineStyle.Dotted]: [ctx.lineWidth, 2 * ctx.lineWidth],
		[LineStyle.Dashed]: [5 * ctx.lineWidth, 6 * ctx.lineWidth],
		[LineStyle.LargeDashed]: [6 * ctx.lineWidth, 6 * ctx.lineWidth],
		[LineStyle.SparseDotted]: [ctx.lineWidth, 4 * ctx.lineWidth],
	};

	const dashPattern = dashPatterns[style];
	ctx.setLineDash(dashPattern);
}
