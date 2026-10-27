import test from 'node:test';
import assert from 'node:assert/strict';

import { SubtitleManager } from '../src/subtitleSync.js';

const make = () => new SubtitleManager(null);

const SRT = `1
00:00:01,000 --> 00:00:03,500
Hello <i>world</i>

2
00:00:04,000 --> 00:00:06,000
Second line
continues
`;

const VTT = `WEBVTT

00:00:01.000 --> 00:00:02.000
First cue

00:00:03.000 --> 00:00:04.000
Second cue
`;

const ASS = `[Script Info]
Title: Sample

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello {\\an8}world
Dialogue: 0,0:00:05.00,0:00:06.50,Default,,0,0,0,,Line one\\NLine two
`;

test('parses SRT cues, strips markup and normalises text', () => {
  const manager = make();
  assert.equal(manager.loadSubtitles(SRT), true);
  assert.equal(manager.cues.length, 2);

  assert.equal(manager.cues[0].text, 'Hello world');
  assert.equal(manager.cues[0].start, 1);
  assert.equal(manager.cues[0].end, 3.5);
  assert.equal(manager.cues[0].cleanText, 'hello world');

  assert.equal(manager.cues[1].text, 'Second line\ncontinues');
  assert.equal(manager.cues[1].cleanText, 'second line continues');
});

test('parses WebVTT and ignores the header', () => {
  const manager = make();
  assert.equal(manager.loadSubtitles(VTT), true);
  assert.equal(manager.cues.length, 2);
  assert.equal(manager.cues[0].start, 1);
  assert.equal(manager.cues[1].start, 3);
});

test('parses ASS dialogue lines', () => {
  const manager = make();
  assert.equal(manager.loadSubtitles(ASS), true);
  assert.equal(manager.cues.length, 2);
  assert.equal(manager.cues[0].text, 'Hello world');
  assert.equal(manager.cues[1].text, 'Line one\nLine two');
  assert.equal(manager.cues[1].start, 5);
  assert.equal(manager.cues[1].end, 6.5);
});

test('parses and formats timestamps', () => {
  const manager = make();
  assert.equal(manager.parseTimestamp('00:01:23,456'), 83.456);
  assert.equal(manager.parseTimestamp('01:23.500'), 83.5);
  assert.equal(manager.parseTimestamp('12.25'), 12.25);
  assert.equal(manager.parseTimestamp(''), 0);
  assert.equal(manager.parseTimestamp('not a time'), 0);

  assert.equal(manager.formatTimestamp(83.456), '00:01:23,456');
  assert.equal(manager.formatTimestamp(3661.5), '01:01:01,500');
  assert.equal(manager.formatTimestamp(-2.5), '-00:00:02,500');
});

test('cleans ASS tags, entities and hard breaks', () => {
  const manager = make();
  const cleaned = manager.cleanCueText('{\\an8}Hello &amp; <b>bye</b>\\Nnext');
  assert.equal(cleaned, 'Hello & bye\nnext');
});

test('finds the active cue and honours positive and negative delay', () => {
  const manager = make();
  manager.loadSubtitles(SRT);

  assert.equal(manager.update(2).id, 1);
  assert.equal(manager.update(0.5), null);
  assert.equal(manager.update(3.6), null);

  manager.setDelay(1);
  assert.equal(manager.update(1.5), null, 'effective 0.5s is before the first cue');
  assert.equal(manager.update(2).id, 1, 'effective 1.0s lands on the inclusive boundary');
  assert.equal(manager.update(2.5).id, 1, 'effective 1.5s is inside the cue');

  manager.setDelay(-1);
  assert.equal(manager.update(0.5).id, 1, 'negative delay pulls the cue earlier');
});

test('delay arithmetic keeps an undo history', () => {
  const manager = make();
  manager.loadSubtitles(SRT);

  manager.setDelay(1);
  manager.setDelay(2.25);
  assert.equal(manager.delay, 2.25);
  assert.equal(manager.undoDelay(), 1);
  assert.equal(manager.delay, 1);
  assert.equal(manager.undoDelay(), 0);
  assert.equal(manager.undoDelay(), null, 'empty history returns null');
});

test('rounds delay to milliseconds and simulates desync', () => {
  const manager = make();
  manager.loadSubtitles(SRT);

  manager.setDelay(0.12345);
  assert.equal(manager.delay, 0.123);

  manager.setDelay(0);
  assert.equal(manager.simulateDesync(2.5), 2.5);
  manager.adjustDelay(-0.05);
  assert.equal(manager.delay, 2.45);
});

test('disabling subtitles clears the active cue', () => {
  const manager = make();
  manager.loadSubtitles(SRT);
  assert.ok(manager.update(2));

  manager.setEnabled(false);
  assert.equal(manager.update(2), null);
  assert.equal(manager.subtitlesEnabled, false);

  manager.setEnabled(true);
  assert.equal(manager.update(2).id, 1);
});

test('rejects empty or malformed subtitle input', () => {
  const manager = make();
  assert.equal(manager.loadSubtitles(''), false);
  assert.equal(manager.loadSubtitles(null), false);
  assert.equal(manager.loadSubtitles('just some text'), false);
  assert.deepEqual(manager.cues, []);
});
