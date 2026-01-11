export type TypedArray = Uint8Array | Uint16Array | Uint32Array;
export type NumberArray = number[] | TypedArray;

// Array factory types
interface ArrayModule {
  array8: (n: number) => NumberArray;
  array16: (n: number) => NumberArray;
  array32: (n: number) => NumberArray;
  arrayLengthen: (array: NumberArray, length: number) => NumberArray;
  arrayWiden: (array: NumberArray, width: number) => NumberArray;
  bitarray: typeof Bitarray;
}

function arrayUntyped(n: number): number[] {
  const array = new Array<number>(n);
  let i = -1;
  while (++i < n) array[i] = 0;
  return array;
}

function arrayLengthenUntyped(array: NumberArray, length: number): NumberArray {
  if (!Array.isArray(array)) {
    // TypedArray path
    if (array.length >= length) return array;
    let copy: TypedArray;
    if (array instanceof Uint8Array) {
      copy = new Uint8Array(length);
    } else if (array instanceof Uint16Array) {
      copy = new Uint16Array(length);
    } else {
      copy = new Uint32Array(length);
    }
    copy.set(array);
    return copy;
  }
  // Regular array path
  let n = array.length;
  while (n < length) array[n++] = 0;
  return array;
}

function arrayWidenUntyped(array: NumberArray, width: number): NumberArray {
  if (!Array.isArray(array)) {
    // TypedArray path
    let copy: TypedArray;
    switch (width) {
      case 16:
        copy = new Uint16Array(array.length);
        break;
      case 32:
        copy = new Uint32Array(array.length);
        break;
      default:
        throw new Error("invalid array width!");
    }
    copy.set(array);
    return copy;
  }
  // Regular array path - nothing to do, regular arrays can hold any number
  if (width > 32) throw new Error("invalid array width!");
  return array;
}

// An arbitrarily-wide array of bitmasks
export class Bitarray {
  length: number;
  subarrays: number;
  width: number;
  masks: Record<number, number>;
  private subarrayData: NumberArray[];

  constructor(n: number) {
    this.length = n;
    this.subarrays = 1;
    this.width = 8;
    this.masks = { 0: 0 };
    this.subarrayData = [typeof Uint8Array !== "undefined" ? new Uint8Array(n) : arrayUntyped(n)];
  }

  getSubarray(index: number): NumberArray {
    return this.subarrayData[index];
  }

  setSubarray(index: number, array: NumberArray): void {
    this.subarrayData[index] = array;
  }

  lengthen(n: number): void {
    for (let i = 0; i < this.subarrays; ++i) {
      this.subarrayData[i] = arrayLengthenUntyped(this.subarrayData[i], n);
    }
    this.length = n;
  }

  // Reserve a new bit index in the array, returns {offset, one}
  add(): { offset: number; one: number } {
    let m: number, w: number, one: number;

    for (let i = 0; i < this.subarrays; ++i) {
      m = this.masks[i];
      w = this.width - (32 * i);
      // isolate the rightmost zero bit and return it as an unsigned int of 32 bits
      one = (~m & (m + 1)) >>> 0;

      if (w >= 32 && !one) {
        continue;
      }

      if (w < 32 && (one & (1 << w))) {
        // widen this subarray
        this.subarrayData[i] = arrayWidenUntyped(this.subarrayData[i], w <<= 1);
        this.width = 32 * i + w;
      }

      this.masks[i] |= one;

      return { offset: i, one: one };
    }

    // add a new subarray
    this.subarrayData[this.subarrays] = typeof Uint8Array !== "undefined"
      ? new Uint8Array(this.length)
      : arrayUntyped(this.length);
    this.masks[this.subarrays] = 1;
    this.width += 8;
    return { offset: this.subarrays++, one: 1 };
  }

  // Copy record from index src to index dest
  copy(dest: number, src: number): void {
    for (let i = 0; i < this.subarrays; ++i) {
      this.subarrayData[i][dest] = this.subarrayData[i][src];
    }
  }

  // Truncate the array to the given length
  truncate(n: number): void {
    for (let i = 0; i < this.subarrays; ++i) {
      for (let j = this.length - 1; j >= n; j--) {
        this.subarrayData[i][j] = 0;
      }
    }
    this.length = n;
  }

  // Checks that all bits for the given index are 0
  zero(n: number): boolean {
    for (let i = 0; i < this.subarrays; ++i) {
      if (this.subarrayData[i][n]) {
        return false;
      }
    }
    return true;
  }

  // Checks that all bits for the given index are 0 except for possibly one
  zeroExcept(n: number, offset: number, zero: number): boolean {
    for (let i = 0; i < this.subarrays; ++i) {
      if (i === offset ? this.subarrayData[i][n] & zero : this.subarrayData[i][n]) {
        return false;
      }
    }
    return true;
  }

  // Checks that all bits for the given index are 0 except for the specified mask.
  zeroExceptMask(n: number, mask: number[]): boolean {
    for (let i = 0; i < this.subarrays; ++i) {
      if (this.subarrayData[i][n] & mask[i]) {
        return false;
      }
    }
    return true;
  }

  // Checks that only the specified bit is set for the given index
  only(n: number, offset: number, one: number): boolean {
    for (let i = 0; i < this.subarrays; ++i) {
      if (this.subarrayData[i][n] != (i === offset ? one : 0)) {
        return false;
      }
    }
    return true;
  }

  // Checks that only the specified bit is set for the given index except for possibly one other
  onlyExcept(n: number, offset: number, zero: number, onlyOffset: number, onlyOne: number): boolean {
    let mask: number;
    for (let i = 0; i < this.subarrays; ++i) {
      mask = this.subarrayData[i][n];
      if (i === offset)
        mask = (mask & zero) >>> 0;
      if (mask != (i === onlyOffset ? onlyOne : 0)) {
        return false;
      }
    }
    return true;
  }

  // Bit manipulation methods
  orAt(offset: number, index: number, value: number): void {
    this.subarrayData[offset][index] |= value;
  }

  xorAt(offset: number, index: number, value: number): void {
    this.subarrayData[offset][index] ^= value;
  }

  andAt(offset: number, index: number, value: number): void {
    this.subarrayData[offset][index] &= value;
  }

  getAt(offset: number, index: number): number {
    return this.subarrayData[offset][index];
  }
}

const xfilterArray: ArrayModule = {
  array8: typeof Uint8Array !== "undefined" ? (n: number) => new Uint8Array(n) : arrayUntyped,
  array16: typeof Uint16Array !== "undefined" ? (n: number) => new Uint16Array(n) : arrayUntyped,
  array32: typeof Uint32Array !== "undefined" ? (n: number) => new Uint32Array(n) : arrayUntyped,
  arrayLengthen: arrayLengthenUntyped,
  arrayWiden: arrayWidenUntyped,
  bitarray: Bitarray
};

export default xfilterArray;
