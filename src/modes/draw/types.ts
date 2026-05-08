/**
 * Draw mode shape and tool types. Coordinates are stored in canvas
 * internal pixels (output dimensions). Stroke width is also in canvas
 * pixels — a 4px stroke is 4 actual pixels of the exported image.
 */

export type Tool =
  | 'select'
  | 'pen'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'text';

export interface BaseShape {
  id: string;
  stroke: string;
  /** null = no fill (stroke-only). */
  fill: string | null;
  strokeWidth: number;
}

export interface PenShape extends BaseShape {
  type: 'pen';
  /** Raw points captured during the stroke. The renderer smooths them
   *  via quadratic curves at paint time. */
  points: Array<{ x: number; y: number }>;
}

export interface RectShape extends BaseShape {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TextShape extends BaseShape {
  type: 'text';
  x: number;
  y: number;
  text: string;
  /** Font size in canvas pixels. */
  size: number;
}

export type Shape =
  | PenShape
  | RectShape
  | EllipseShape
  | ArrowShape
  | TextShape;

export interface DrawSnapshot {
  shapes: Shape[];
  /** Canvas dimensions at the time of snapshot. */
  width: number;
  height: number;
}

export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}
