export type ApiStatus = "success" | "error";

export type ApiResponse<T> = {
  status: ApiStatus;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  status: "error";
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};
