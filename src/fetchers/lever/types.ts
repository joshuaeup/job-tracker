export type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  categories: {
    location?: string;
    allLocations?: string;
    team?: string;
    department?: string;
  };
  createdAt?: number;
  descriptionPlain?: string;
  salaryRange?: Record<string, unknown>;
  compensation?: Record<string, unknown>;
};

export type LeverResponse = LeverJob[];
