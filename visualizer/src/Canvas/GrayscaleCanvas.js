import React, { useEffect, useRef } from 'react';
import { useSelector } from '@xstate/react';
import { useRaw, useChannel, useCanvas } from '../ServiceContext';
import { adjustRangeImageData, invertImageData } from '../imageUtils';

export const GrayscaleCanvas = ({ className }) => {
  
  const canvas = useCanvas();
  const sx = useSelector(canvas, state => state.context.sx);
  const sy = useSelector(canvas, state => state.context.sy);
  const zoom = useSelector(canvas, state => state.context.zoom);
  const scale = useSelector(canvas, state => state.context.scale);
  const sw = useSelector(canvas, state => state.context.width);
  const sh = useSelector(canvas, state => state.context.height);
  
  const width = sw * scale * window.devicePixelRatio;
  const height = sh * scale * window.devicePixelRatio;
  
  const raw = useRaw();
  const invert = useSelector(raw, state => state.context.invert);
  const layer = useSelector(raw, state => state.context.layers[0]);

  const channelIndex = useSelector(layer, state => state.context.channel);
  const [min, max] = useSelector(layer, state => state.context.range);

  const channel = useChannel(channelIndex);
  const rawImage = useSelector(channel, state => state.context.rawImage);

  const canvasRef = useRef();
  const ctxRef = useRef();
  const hiddenCanvasRef = useRef();
  const hiddenCtxRef = useRef();

  useEffect(() => {
    ctxRef.current = canvasRef.current.getContext('2d');
    ctxRef.current.imageSmoothingEnabled = false;
  }, [height, width]);

  useEffect(() => {
    hiddenCtxRef.current = hiddenCanvasRef.current.getContext('2d');
  }, [sw, sh]);

  useEffect(() => {
    // draw image onto canvas to get image data
    const ctx = hiddenCtxRef.current;
    ctx.drawImage(rawImage, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    // adjust image data
    adjustRangeImageData(imageData, min, max);
    if (invert) { invertImageData(imageData); }
    // redraw with adjusted data
    ctx.putImageData(imageData, 0, 0);
  }, [rawImage, min, max, invert, width, height]);

  useEffect(() => {
    const hiddenCanvas = hiddenCanvasRef.current;
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(
      hiddenCanvas,
      sx, sy,
      sw / zoom, sh / zoom,
      0, 0,
      width, height,
    );
  }, [rawImage, min, max, invert, sx, sy, zoom, sw, sh, width, height]);

  return <>
    {/* hidden processing canvas */}
    <canvas id='raw-processing'
      hidden={true}
      ref={hiddenCanvasRef}
      width={sw}
      height={sh}
    />
    {/* visible output canvas */}
    <canvas id='raw-canvas'
      className={className}
      ref={canvasRef}
      width={width}
      height={height}
    />
  </>;
};

export default GrayscaleCanvas;