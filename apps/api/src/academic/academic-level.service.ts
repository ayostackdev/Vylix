export interface StudentContext {
  entryYear: number;
  collegeDurationYears: number;
}

export class AcademicLevelService {
  private static getActiveSessionStartYear(): number {
    const systemDate = new Date();
    const currentYear = systemDate.getFullYear();
    const currentMonth = systemDate.getMonth();

    if (currentMonth < 8) {
      return currentYear - 1;
    }

    return currentYear;
  }

  public static calculateLevel(context: StudentContext): string {
    const { entryYear, collegeDurationYears } = context;
    const sessionStartYear = this.getActiveSessionStartYear();
    const yearsElapsed = sessionStartYear - entryYear + 1;

    if (yearsElapsed <= 0) {
      return 'Incoming Freshman';
    }

    if (yearsElapsed > collegeDurationYears) {
      return 'Alumni';
    }

    return `${yearsElapsed * 100}L`;
  }
}
