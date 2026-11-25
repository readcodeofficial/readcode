export interface LabResult {
    patientMrn: string;
    testCode: string; // LOINC
    value: number;
    unit: string;
    collectedAt: string;
}

export class MalformedResultError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MalformedResultError";
    }
}

export class UnknownPatientError extends Error {
    constructor(mrn: string) {
        super(`no chart for MRN ${mrn}`);
        this.name = "UnknownPatientError";
    }
}

// The lab interface engine sends one observation per message: MRN|LOINC|value|unit|collected-at
export function parseResult(body: string): LabResult {
    const parts = body.split("|");
    if (parts.length !== 5) throw new MalformedResultError(`expected 5 fields, got ${parts.length}`);
    const [patientMrn, testCode, rawValue, unit, collectedAt] = parts;
    const value = Number(rawValue);
    if (!patientMrn || !testCode || rawValue === "" || !Number.isFinite(value)) throw new MalformedResultError("missing or non-numeric field");
    if (Number.isNaN(Date.parse(collectedAt))) throw new MalformedResultError("collected-at is not a timestamp");
    return { patientMrn, testCode, value, unit, collectedAt };
}

// Patient charts. Results for a patient registration hasn't reached yet are rejected; that
// usually resolves within minutes, so callers retry.
export class ChartStore {
    private readonly charts = new Map<string, LabResult[]>();

    register(mrn: string): void {
        if (!this.charts.has(mrn)) this.charts.set(mrn, []);
    }

    async addResult(r: LabResult): Promise<void> {
        const chart = this.charts.get(r.patientMrn);
        if (!chart) throw new UnknownPatientError(r.patientMrn);
        chart.push(r);
    }

    resultsFor(mrn: string): LabResult[] {
        return [...(this.charts.get(mrn) ?? [])];
    }
}
