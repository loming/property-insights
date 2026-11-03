/** RFC 9457 problem+json, as every backend returns it. Safe to import on the client. */
export type FieldError = { field: string; message: string };

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  request_id?: string | null;
  errors?: FieldError[];
  indices?: number[];
};

export type Service = "estimator" | "market";

export class ApiError extends Error {
  readonly problem: Problem;
  readonly service: Service;

  constructor(problem: Problem, service: Service, options?: { cause?: unknown }) {
    super(problem.detail ?? problem.title, options);
    this.name = "ApiError";
    this.problem = problem;
    this.service = service;
  }

  get status(): number {
    return this.problem.status;
  }
}

export function isProblem(value: unknown): value is Problem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Problem).type === "string" &&
    typeof (value as Problem).status === "number"
  );
}
