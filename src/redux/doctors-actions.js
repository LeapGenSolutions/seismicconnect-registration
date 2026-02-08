import { fetchDoctorsFromHistory } from '../api/callHistory';
import { doctorsActions } from './doctors-slice';

export const fetchDoctors = (clinicName) => {
  return async (dispatch) => {
    try {
      const doctorsData = await fetchDoctorsFromHistory(clinicName);
      dispatch(doctorsActions.setDoctorsFromHistory(doctorsData));
    } catch (error) {
      throw new Error('Could not fetch doctors from history!');
    }
  };
};
