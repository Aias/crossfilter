type NumericArray = Uint8Array | Uint16Array | Uint32Array;

function arrayLengthen(array: NumericArray, length: number) {
  if (array.length >= length) return array;
  const copy =
    array instanceof Uint8Array
      ? new Uint8Array(length)
      : array instanceof Uint16Array
        ? new Uint16Array(length)
        : new Uint32Array(length);
  copy.set(array);
  return copy;
}

function arrayWiden(array: NumericArray, width: number) {
  let copy: Uint16Array | Uint32Array;
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

function arrayUntyped(n: number) {
  const array = new Array<number>(n);
  let i = -1;
  while (++i < n) array[i] = 0;
  return array;
}

function arrayLengthenUntyped(array: number[], length: number) {
  let n = array.length;
  while (n < length) array[n++] = 0;
  return array;
}

function arrayWidenUntyped(array: number[], width: number) {
  if (width > 32) throw new Error("invalid array width!");
  return array;
}

class BitArray {
  [index: number]: NumericArray;
  length: number;
  subarrays = 1;
  width = 8;
  masks: Record<number, number> = { 0: 0 };

  constructor(n: number) {
    this.length = n;
    this[0] = new Uint8Array(n);
  }

  lengthen(n: number) {
    for (let i = 0, len = this.subarrays; i < len; ++i) {
      this[i] = arrayLengthen(this[i], n);
    }
    this.length = n;
  }

  add() {
    for (let i = 0, len = this.subarrays; i < len; ++i) {
      const mask = this.masks[i];
      let width = this.width - 32 * i;
      const one = (~mask & (mask + 1)) >>> 0;

      if (width >= 32 && !one) continue;

      if (width < 32 && one & (1 << width)) {
        this[i] = arrayWiden(this[i], (width <<= 1));
        this.width = 32 * i + width;
      }

      this.masks[i] |= one;
      return { offset: i, one };
    }

    this[this.subarrays] = new Uint8Array(this.length);
    this.masks[this.subarrays] = 1;
    this.width += 8;
    return { offset: this.subarrays++, one: 1 };
  }

  copy(dest: number, src: number) {
    for (let i = 0, len = this.subarrays; i < len; ++i) {
      this[i][dest] = this[i][src];
    }
  }

  truncate(n: number) {
    for (let i = 0, len = this.subarrays; i < len; ++i) {
      for (let j = this.length - 1; j >= n; j--) this[i][j] = 0;
    }
    this.length = n;
  }

  zero(n: number) {
    if (this.subarrays === 1) return !this[0][n];
    for (let i = 0, len = this.subarrays; i < len; ++i) {
      if (this[i][n]) return false;
    }
    return true;
  }

  zeroExcept(n: number, offset: number, zero: number) {
    if (this.subarrays === 1) return !(offset === 0 ? this[0][n] & zero : this[0][n]);
    for (let i = 0, len = this.subarrays; i < len; ++i) {
      if (i === offset ? this[i][n] & zero : this[i][n]) return false;
    }
    return true;
  }

  zeroExceptMask(n: number, mask: readonly number[]) {
    if (this.subarrays === 1) return (this[0][n] & mask[0]) === 0;
    for (let i = 0, len = this.subarrays; i < len; ++i) {
      if (this[i][n] & mask[i]) return false;
    }
    return true;
  }

  only(n: number, offset: number, one: number) {
    if (this.subarrays === 1) return this[0][n] === (offset === 0 ? one : 0);
    for (let i = 0, len = this.subarrays; i < len; ++i) {
      if (this[i][n] != (i === offset ? one : 0)) return false;
    }
    return true;
  }

  onlyExcept(n: number, offset: number, zero: number, onlyOffset: number, onlyOne: number) {
    if (this.subarrays === 1) {
      const mask = offset === 0 ? (this[0][n] & zero) >>> 0 : this[0][n];
      return mask === (onlyOffset === 0 ? onlyOne : 0);
    }
    for (let i = 0, len = this.subarrays; i < len; ++i) {
      let mask = this[i][n];
      if (i === offset) mask = (mask & zero) >>> 0;
      if (mask != (i === onlyOffset ? onlyOne : 0)) return false;
    }
    return true;
  }
}

export default {
  array8: arrayUntyped,
  array16: arrayUntyped,
  array32: arrayUntyped,
  arrayLengthen: arrayLengthenUntyped,
  arrayWiden: arrayWidenUntyped,
  bitarray: BitArray,
};
