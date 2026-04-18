export type AshbyJob = {
  id: string;
  title: string;
  locationName: string;
  jobUrl: string;
  workplaceType: string;
  departmentName?: string;
  publishedAt?: string;
  createdAt?: string;
  compensation?: Record<string, unknown>;
  descriptionHtml?: string;
};

export type AshbyResponse = {
  jobs: AshbyJob[];
};
