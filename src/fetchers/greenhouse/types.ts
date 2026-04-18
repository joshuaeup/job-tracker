export type GreenhouseJob = {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  departments?: { name: string }[];
  updated_at?: string;
  first_published?: string;
  description?: string;
  metadata?: Record<string, unknown>[];
};

export type GreenhouseResponse = {
  jobs: GreenhouseJob[];
};
