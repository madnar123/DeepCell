import { Box, FormLabel, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import SpotColorToggle from './SpotColorToggle';
import SpotOpacitySlider from './SpotOpacitySlider';
import SpotOutlineToggle from './SpotOutlineToggle';
import SpotRadiusSlider from './SpotRadiusSlider';
import SpotsCheckbox from './SpotsCheckbox';

function SpotsControls() {
  return (
    <Grid container direction='column' justifyContent='center' sx={{ pt: 1 }}>
      <Grid container direction='row'>
        <Grid item xs={4}>
          <FormLabel>Spots</FormLabel>
        </Grid>
        <Grid item xs={7} />
        <Grid item xs={1}>
          <SpotsCheckbox />
        </Grid>
      </Grid>
      <Grid container direction='row'>
        <Box
          display='flex'
          flexDirection='row'
          justifyContent='space-between'
          sx={{ width: '100%' }}
        >
          <SpotOutlineToggle />
          <SpotColorToggle />
        </Box>
      </Grid>
      <Grid container direction='row' alignItems='center'>
        <Grid item xs={4}>
          <Typography>Radius</Typography>
        </Grid>
        <Grid container item xs={8} alignItems='center'>
          <SpotRadiusSlider />
        </Grid>
      </Grid>
      <Grid container direction='row'>
        <Grid item xs={4}>
          <Typography>Opacity</Typography>
        </Grid>
        <Grid container item xs={8} alignItems='center'>
          <SpotOpacitySlider />
        </Grid>
      </Grid>
    </Grid>
  );
}

export default SpotsControls;