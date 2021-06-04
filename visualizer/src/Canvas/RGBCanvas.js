import React, { useEffect, useRef } from 'react';
import { useSelector } from '@xstate/react';
import { useCanvas, useRaw, useComposeLayers } from '../ServiceContext';
import ChannelCanvas from './ChannelCanvas';

export const RGBCanvas = ({ className }) => {
  
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
  const layers = useSelector(raw, state => state.context.layers);

  const canvasRef = useRef();
  const ctx = useRef();
  const [composeCanvasRef, canvases, setCanvases] = useComposeLayers();

  useEffect(() => {
    ctx.current = canvasRef.current.getContext('2d');
    ctx.current.imageSmoothingEnabled = false;
  }, [height, width]);

  useEffect(() => {
    const composeCanvas = composeCanvasRef.current;
    ctx.current.clearRect(0, 0, width, height);
    ctx.current.drawImage(
      composeCanvas,
      sx, sy,
      sw / zoom, sh / zoom,
      0, 0,
      width, height,
    );
  }, [composeCanvasRef, canvases, invert, sx, sy, zoom, sw, sh, width, height]);

  return <>
    {/* hidden processing canvas */}
    <canvas id='raw-processing'
      hidden={true}
      ref={composeCanvasRef}
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
    {layers
      .map(layer => <ChannelCanvas
        layer={layer}
        setCanvases={setCanvases}
      />)
    }
  </>;
};

export default RGBCanvas;