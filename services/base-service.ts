export abstract class BaseService {
  protected readonly baseUrl: string;

  protected constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
}
