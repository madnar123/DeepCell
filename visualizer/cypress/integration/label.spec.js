/* eslint-disable jest/expect-expect */
/* eslint-disable no-undef */

const fakeProject = {
  projectId: 'fakefakefake',
  numChannels: 2,
  numFeatures: 2,
  numFrames: 2,
  height: 2,
  width: 2,
};

const fakeRawArray = {
  body: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]).buffer,
};
const fakeLabeledArray = {
  body: new Int32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer,
};
const fakeLabels = {
  0: {
    segments: [],
  },
  1: {
    segments: [],
  },
};

it('finds DeepCell Label homepage text', () => {
  cy.visit('/');
  cy.contains('DeepCell Label');
  cy.contains('Upload');
  cy.contains('select an example file');
  cy.contains('Submit');
  cy.contains('The Van Valen Lab');
  cy.contains('Caltech');
});

it('Create a project from an example file', () => {
  cy.visit('/');
  cy.get('.MuiNativeSelect-select').select('2D tissue segmentation');
  cy.get('#submitExample').click();
  cy.get('.MuiLinearProgress-root');
  cy.url({ timeout: 30000 })
    .should('include', '/project')
    .and('include', 'projectId=')
    .and('include', 'download=true');
  cy.get('.MuiCircularProgress-svg');
  cy.get('canvas');
  cy.contains('DeepCell Label');
  cy.contains('Instructions');
  cy.contains('Download');
  cy.contains('Segmentations');
  cy.contains('Channels');
  cy.contains('Undo');
  cy.contains('Redo');
  cy.get('.MuiCircularProgress-svg').should('not.exist');
});

it('shows loading spinner', () => {
  cy.visit('/project?projectId=fakefakefake');
  cy.get('.MuiCircularProgress-svg');
});

it('Creates a tracking project', () => {
  cy.visit('/');
  cy.get('.MuiNativeSelect-select').select('uncorrected tracking timelapse');
  cy.get('#submitExample').click();
  cy.get('.MuiLinearProgress-root');
  cy.url({ timeout: 30000 })
    .should('include', '/project')
    .and('include', 'projectId=')
    .and('include', 'download=true')
    .and('include', 'track=true');
  cy.get('.MuiCircularProgress-svg');
  cy.get('canvas');
  cy.contains('Track');
  cy.get('.MuiCircularProgress-svg').should('not.exist');
});

it('updates state with keybinds', () => {
  cy.intercept('GET', '/api/project/fakefakefake', fakeProject);
  cy.intercept('GET', '/api/raw/fakefakefake', fakeRawArray);
  cy.intercept('GET', '/api/labeled/fakefakefake', fakeLabeledArray);
  cy.intercept('GET', '/api/labels/fakefakefake', fakeLabels);

  cy.visit('/project?projectId=fakefakefake');
  cy.get('.MuiCircularProgress-svg').should('not.exist');
  cy.get('body').type('b');
  cy.contains('Brush').should('have.attr', 'aria-pressed', 'true');
  cy.get('body').type('e');
  cy.contains('Eraser').should('have.attr', 'aria-pressed', 'true');
  cy.get('body').type('k');
  cy.contains('Trim').should('have.attr', 'aria-pressed', 'true');
  cy.get('body').type('g');
  cy.contains('Flood').should('have.attr', 'aria-pressed', 'true');

  cy.get('body').type('y');

  cy.get('body').type('t');
  cy.contains('Threshold').should('have.attr', 'aria-pressed', 'true');
});

it('opens instructions', () => {
  cy.intercept('GET', '/api/project/fakefakefake', fakeProject);
  cy.intercept('GET', '/api/raw/fakefakefake', fakeRawArray);
  cy.intercept('GET', '/api/labeled/fakefakefake', fakeLabeledArray);
  cy.intercept('GET', '/api/labels/fakefakefake', fakeLabels);

  cy.visit('/project?projectId=fakefakefake');
  cy.contains('Instructions').click();
  cy.contains('Display').click();
  cy.contains('Canvas').click();
  cy.contains('Select Labels').click();
  cy.contains('Tools').click();
  cy.contains('Actions').click();
});

it('shows quality control interface', () => {
  cy.intercept('GET', '/api/project/fakefakefake', fakeProject);
  cy.intercept('GET', '/api/raw/fakefakefake', fakeRawArray);
  cy.intercept('GET', '/api/labeled/fakefakefake', fakeLabeledArray);
  cy.intercept('GET', '/api/labels/fakefakefake', fakeLabels);

  cy.visit('/project?projectId=fakefakefake,fakefakefake');
  cy.contains('Accept');
  cy.contains('Reject');
  cy.contains('Download QC');

  cy.contains('Accept').click();
});

it('removes channel', () => {
  cy.intercept('GET', '/api/project/fakefakefake', fakeProject);
  cy.intercept('GET', '/api/raw/fakefakefake', fakeRawArray);
  cy.intercept('GET', '/api/labeled/fakefakefake', fakeLabeledArray);
  cy.intercept('GET', '/api/labels/fakefakefake', fakeLabels);

  cy.visit('/project?projectId=fakefakefake');
  cy.contains('channel 0');
  cy.get('[data-testid="layer0-options"]').click();
  cy.contains('Remove').click();
  cy.contains('channel 0').should('not.exist');
});
