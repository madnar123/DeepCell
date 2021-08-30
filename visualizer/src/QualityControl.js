import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import { useSelector } from '@xstate/react';
import { ResizeSensor } from 'css-element-queries';
import debounce from 'lodash.debounce';
import { useEffect, useRef, useState } from 'react';
import { interpret } from 'xstate';
import Canvas from './Canvas/Canvas';
import ImageControls from './Controls/ImageControls/ImageControls';
import QCControls from './Controls/QCControls';
import ActionButtons from './Controls/Segment/ActionButtons';
import SelectedPalette from './Controls/Segment/SelectedPalette';
import ToolButtons from './Controls/Segment/ToolButtons';
import UndoRedo from './Controls/Segment/UndoRedo';
import DivisionAlerts from './Controls/Tracking/Alerts/DivisionAlerts';
import Timeline from './Controls/Tracking/Timeline';
import Footer from './Footer/Footer';
import Instructions from './Instructions/Instructions';
import Navbar from './Navbar';
import ProjectContext, { useCanvas, useLabeled } from './ProjectContext';
import createQualityControlMachine from './service/qualityControlMachine';

const useStyles = makeStyles(theme => ({
  root: {
    boxSizing: 'border-box',
    display: 'flex',
    minHeight: '100vh',
    flexDirection: 'column',
  },
  main: {
    boxSizing: 'border-box',
    display: 'flex',
    flexGrow: 1,
    padding: theme.spacing(1),
    alignItems: 'stretch',
    justifyContent: 'space-evenly',
    minHeight: 'calc(100vh - 66px - 57px - 74px - 1px)',
    // height: 'calc(100vh - 66px - 57px - 60px - 80px - 1px)'
  },
  controlPanelBox: {
    minWidth: '300px',
    flex: '0 0 auto',
  },
  toolbarBox: {
    flex: '0 0 auto',
    padding: theme.spacing(1),
  },
  canvasBox: {
    position: 'relative',
    flex: '1 1 auto',
    maxHeight: '100vh',
    maxWidth: '100vw',
  },
}));

const location = window.location;
const search = new URLSearchParams(location.search);
const projectIds = search.get('projectIds')?.split(',') || [];
const bucket = search.has('bucket') ? search.get('bucket') : 'caliban-output';
const machine = createQualityControlMachine(projectIds, bucket);
const qualityControl = interpret(machine); // , { devTools: true });
qualityControl.start();
window.qc = qualityControl;

export function useQualityControl() {
  return qualityControl;
}

function QualityControlWrapper() {
  const qualityControl = useQualityControl();
  const project = useSelector(qualityControl, state => {
    const { projectId, projects } = state.context;
    return projects[projectId];
  });

  return (
    <ProjectContext project={project}>
      <QualityControl />
    </ProjectContext>
  );
}

function QualityControl() {
  const styles = useStyles();

  const canvasBoxRef = useRef({ offsetWidth: 0, offsetHeight: 0 });
  const [canvasBoxWidth, setCanvasBoxWidth] = useState(0);
  const [canvasBoxHeight, setCanvasBoxHeight] = useState(0);

  const canvas = useCanvas();
  const labeled = useLabeled();

  useEffect(() => {
    const setCanvasBoxDimensions = () => {
      setCanvasBoxWidth(canvasBoxRef.current.offsetWidth);
      setCanvasBoxHeight(canvasBoxRef.current.offsetHeight);
    };
    setCanvasBoxDimensions();

    new ResizeSensor(canvasBoxRef.current, debounce(setCanvasBoxDimensions, 20));
  }, [canvasBoxRef]);

  useEffect(() => {
    const padding = 5;
    canvas.send({
      type: 'DIMENSIONS',
      width: canvasBoxWidth,
      height: canvasBoxHeight,
      padding,
    });
  }, [canvas, canvasBoxWidth, canvasBoxHeight]);

  return (
    <div className={styles.root}>
      <Navbar />
      <Instructions />
      <Box className={styles.main}>
        <Box className={styles.controlPanelBox}>
          <QCControls />
          <ImageControls />
          {labeled && <Timeline />}
          <DivisionAlerts />
        </Box>
        <Box className={styles.toolbarBox}>
          <UndoRedo />
          <ToolButtons />
          <ActionButtons />
          {labeled && <SelectedPalette />}
        </Box>
        <Box ref={canvasBoxRef} className={styles.canvasBox}>
          <Canvas />
        </Box>
      </Box>
      <Footer />
    </div>
  );
}

export default QualityControlWrapper;
