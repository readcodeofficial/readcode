export interface Shipment {
    id: string;
    weightGrams: number;
    postcode: string;
}

export interface Label {
    shipmentId: string;
    trackingNumber: string;
}

// The carrier's label API. It charges per call, so we send labels in batches.
export interface CarrierApi {
    createLabels(shipments: Shipment[]): Promise<Label[]>;
}
