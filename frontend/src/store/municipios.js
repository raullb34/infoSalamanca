// frontend/src/store/municipios.js
import { defineStore } from 'pinia';
import { api } from '../services/api';

export const useMunicipiosStore = defineStore('municipios', {
  state: () => ({
    selectedMunicipio: null,
    municipioData: null,
    loading: false,
  }),

  actions: {
    async selectMunicipio(id) {
      this.loading = true;
      try {
        const data = await api.getMunicipio(id);
        this.municipioData = data;
        this.selectedMunicipio = id;
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    }
  }
});