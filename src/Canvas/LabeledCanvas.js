import React, { useEffect, useRef } from 'react';
import { useSelector } from '@xstate/react';

const highlightImageData = (data, label) => {
  for (let i = 0; i < data.length; i += 4) {
    // TODO: access label array
    const element = 'TODO';
    if ( element === label) {
      data[i] += 255; // red
      data[i + 1] -= 255; // green
      data[i + 2] -= 255; // blue
    }
  }
  return data;
};

const removeNoLabelImageData = (data) => {
  for (let i = 0; i < data.length; i += 4) {
    // TODO: access label array
    // if ( label === 0) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
      data[i + 3] = 0;
    }
  }
  return data;
};

const opacityImageData = (data, opacity) => {
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] *= opacity;
  }
  return data;
};

export const LabeledCanvas = ({ feature, sx, sy, sw, sh, zoom, ...props }) => {

  const highlight = useSelector(feature, state => state.context.highlight);
  const showNoLabel = useSelector(feature, state => state.context.showNoLabel);
  const opacity = useSelector(feature, state => state.context.opacity);
  const labeledImage = useSelector(feature, state => state.context.labeledImage);
  const [foreground, background] = [1, 2];

  const canvasRef = useRef();
  const ctx = useRef();
  const labelCanvas = new OffscreenCanvas(sw, sh);
  const labelCtx = labelCanvas.getContext('2d');

  useEffect(() => {
    ctx.current = canvasRef.current.getContext('2d');
    ctx.current.imageSmoothingEnabled = false;
  }, [props]);

  useEffect(() => {
    labelCtx.drawImage(labeledImage, 0, 0);
    let data = labelCtx.getImageData(0, 0, sw, sh).data;
    if (highlight) {
      data = highlightImageData(data, foreground);
    }
    if (!showNoLabel) {
      data = removeNoLabelImageData(data);
    }
    data = opacityImageData(data, opacity);
    const adjustedData = new ImageData(data, sw, sh);
    labelCtx.putImageData(adjustedData, 0, 0);
  }, [labeledImage, foreground, highlight, showNoLabel, opacity, sh, sw, labelCtx]);

  useEffect(() => {
    ctx.current.save();
    ctx.current.clearRect(0, 0, props.width, props.height);
    ctx.current.drawImage(
      labelCanvas,
      sx, sy,
      sw / zoom, sh / zoom,
      0, 0,
      props.width, props.height,
    );
    ctx.current.restore();
  }, [labelCanvas, sx, sy, zoom, sw, sh, props.width, props.height]);

  return <canvas id='labeled-canvas'
    ref={canvasRef}
    {...props}
  />;
};

export default React.memo(LabeledCanvas);
