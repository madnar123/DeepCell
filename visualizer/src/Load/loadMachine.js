import axios from 'axios';
import { assign, Machine } from 'xstate';

const DCL_DOMAIN = 'http://localhost:3000';

function submitExample(context) {
  const { exampleFile } = context;
  const formData = new FormData();
  formData.append('url', exampleFile.path);
  return axios.post('/api/project', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

function submitUpload(context) {
  const { uploadFile, axes } = context;
  const formData = new FormData();
  formData.append('file', uploadFile);
  formData.append('axes', axes);
  axios.post('/api/project/dropped', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

const loadMachine = Machine(
  {
    context: {
      exampleFile: null,
      uploadFile: null,
      axes: 'YXC',
      errorText: '',
    },
    initial: 'idle',
    states: {
      idle: {
        on: {
          SET_EXAMPLE_FILE: { actions: 'setExampleFile' },
          SET_UPLOAD_FILE: [
            { cond: 'isSingleFile', target: 'uploaded', actions: 'setUploadFile' },
            { target: 'error', actions: 'setSingleFileError' },
          ],
          SUBMIT_EXAMPLE: { target: 'submittingExample' },
        },
      },
      uploaded: {
        on: {
          SET_AXES: { actions: 'setAxes' },
          SUBMIT_UPLOAD: { target: 'submittingUpload' },
        },
      },
      submittingExample: {
        invoke: {
          src: submitExample,
          onDone: { actions: 'redirectToProject' },
          onError: { target: 'error', actions: [(c, e) => console.log(e), 'setErrorText'] },
        },
      },
      submittingUpload: {
        src: submitUpload,
        onDone: { actions: 'redirectToProject' },
        onError: { target: 'error', actions: [(c, e) => console.log(e), 'setErrorText'] },
      },
      error: {
        on: {
          SUBMIT_UPLOAD: { target: 'submittingUpload' },
          SUBMIT_EXAMPLE: { target: 'submittingExample' },
          SET_UPLOAD_FILE: [
            { cond: 'isSingleFile', target: 'uploaded', actions: 'setUploadFile' },
            { actions: 'setSingleFileError' },
          ],
        },
      },
    },
  },
  {
    guards: {
      isSingleFile: (_, { files }) => files.length === 1,
    },
    actions: {
      setExampleFile: assign({ exampleFile: (_, { file }) => file }),
      setUploadFile: assign({
        uploadFile: ({ uploadFile }, { files }) => {
          // Revoke the data uris of existing file previews to avoid memory leaks
          if (uploadFile) {
            URL.revokeObjectURL(uploadFile.preview);
          }
          const file = files[0];
          Object.assign(file, { preview: URL.createObjectURL(file) });
          console.log(file);
          return file;
        },
      }),
      setAxes: assign({ axes: (_, { axes }) => axes }),
      setErrorText: assign({ errorText: (_, event) => `${event.error}` }),
      setSingleFileError: assign({ errorText: 'Please upload a single file.' }),
      redirectToProject: (_, event) => {
        const { projectId } = event.data;
        window.location.href = `${DCL_DOMAIN}/project?projectId=${projectId}&download=true`;
      },
    },
  }
);

export default loadMachine;
