import assert from "node:assert/strict";
import test from "node:test";
import { areaSqft, footprintSqft, parseFootprint, rectangleFootprint, rotateFootprint, sideLengthsFt } from "./footprint";

const VENICE = { lat: 33.991974, lng: -118.4481 };

test("a placed footprint measures the size asked for", () => {
  const shape = rectangleFootprint(VENICE, 800);
  assert.ok(Math.abs(areaSqft(shape) - 800) <= 2);
  const [a, b, c, d] = sideLengthsFt(shape);
  assert.equal(a, c);
  assert.equal(b, d);
  assert.ok(Math.abs(a * b - 800) < 40);
});

test("turning a footprint keeps its area", () => {
  const turned = rotateFootprint(rectangleFootprint(VENICE, 600), 30);
  assert.ok(Math.abs(areaSqft(turned) - 600) <= 2);
});

test("drawn order doesn't change the area, and fewer than 3 points has none", () => {
  const shape = rectangleFootprint(VENICE, 450);
  assert.equal(areaSqft([...shape].reverse()), areaSqft(shape));
  assert.equal(areaSqft(shape.slice(0, 2)), 0);
});

test("only sensible saved shapes are accepted", () => {
  assert.equal(parseFootprint([{ lat: 1, lng: 2 }]), null);
  assert.equal(parseFootprint("nope"), null);
  assert.equal(parseFootprint([{ lat: 100, lng: 0 }, { lat: 0, lng: 0 }, { lat: 1, lng: 1 }]), null);
  assert.equal(parseFootprint(rectangleFootprint(VENICE, 500))?.length, 4);
});

test("a drawn shape's size is rounded to the size step and kept in range", () => {
  assert.equal(footprintSqft(rectangleFootprint(VENICE, 752)), 750);
  assert.equal(footprintSqft(rectangleFootprint(VENICE, 150)), 300);
  assert.equal(footprintSqft(rectangleFootprint(VENICE, 2000)), 1200);
});
