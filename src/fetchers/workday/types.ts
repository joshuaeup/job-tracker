export type WorkdayJob = {
  title: string;
  externalPath: string;
  locationsText: string;
  jobReqId?: string;
};

export type WorkdayRequest = {
  limit: number;
  offset: number;
  searchText: string;
  appliedFacets: Record<string, unknown>;
};

export type WorkdayResponse = {
  jobPostings: WorkdayJob[];
  total: number;
};
