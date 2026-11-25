// Carriers bill and throttle per segment, not per message. Plain GSM text fits 160 characters
// in one segment, or 153 per segment once it is split (the rest is the concatenation header).
// Anything outside that alphabet is sent as UCS-2: 70 characters, or 67 per split segment.
const GSM_BASIC = /^[A-Za-z0-9 \n\r@$!"#%&'()*+,\-./:;<=>?_]*$/;

export function countSegments(text: string): number {
    if (text.length === 0) return 0;
    const [single, multi] = GSM_BASIC.test(text) ? [160, 153] : [70, 67];
    const length = [...text].length;
    return length <= single ? 1 : Math.ceil(length / multi);
}
