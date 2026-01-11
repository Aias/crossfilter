// https://crossfilter.github.io/crossfilter/ v1.5.4 Copyright 2026 Mike Bostock
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.crossfilter = factory());
})(this, (function () { 'use strict';

    function arrayUntyped(n) {
        const array = new Array(n);
        let i = -1;
        while (++i < n)
            array[i] = 0;
        return array;
    }
    function arrayLengthenUntyped(array, length) {
        if (!Array.isArray(array)) {
            // TypedArray path
            if (array.length >= length)
                return array;
            let copy;
            if (array instanceof Uint8Array) {
                copy = new Uint8Array(length);
            }
            else if (array instanceof Uint16Array) {
                copy = new Uint16Array(length);
            }
            else {
                copy = new Uint32Array(length);
            }
            copy.set(array);
            return copy;
        }
        // Regular array path
        let n = array.length;
        while (n < length)
            array[n++] = 0;
        return array;
    }
    function arrayWidenUntyped(array, width) {
        if (!Array.isArray(array)) {
            // TypedArray path
            let copy;
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
        if (width > 32)
            throw new Error("invalid array width!");
        return array;
    }
    // An arbitrarily-wide array of bitmasks
    class Bitarray {
        constructor(n) {
            this.length = n;
            this.subarrays = 1;
            this.width = 8;
            this.masks = { 0: 0 };
            this.subarrayData = [typeof Uint8Array !== "undefined" ? new Uint8Array(n) : arrayUntyped(n)];
        }
        getSubarray(index) {
            return this.subarrayData[index];
        }
        setSubarray(index, array) {
            this.subarrayData[index] = array;
        }
        lengthen(n) {
            for (let i = 0; i < this.subarrays; ++i) {
                this.subarrayData[i] = arrayLengthenUntyped(this.subarrayData[i], n);
            }
            this.length = n;
        }
        // Reserve a new bit index in the array, returns {offset, one}
        add() {
            let m, w, one;
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
        copy(dest, src) {
            for (let i = 0; i < this.subarrays; ++i) {
                this.subarrayData[i][dest] = this.subarrayData[i][src];
            }
        }
        // Truncate the array to the given length
        truncate(n) {
            for (let i = 0; i < this.subarrays; ++i) {
                for (let j = this.length - 1; j >= n; j--) {
                    this.subarrayData[i][j] = 0;
                }
            }
            this.length = n;
        }
        // Checks that all bits for the given index are 0
        zero(n) {
            for (let i = 0; i < this.subarrays; ++i) {
                if (this.subarrayData[i][n]) {
                    return false;
                }
            }
            return true;
        }
        // Checks that all bits for the given index are 0 except for possibly one
        zeroExcept(n, offset, zero) {
            for (let i = 0; i < this.subarrays; ++i) {
                if (i === offset ? this.subarrayData[i][n] & zero : this.subarrayData[i][n]) {
                    return false;
                }
            }
            return true;
        }
        // Checks that all bits for the given index are 0 except for the specified mask.
        zeroExceptMask(n, mask) {
            for (let i = 0; i < this.subarrays; ++i) {
                if (this.subarrayData[i][n] & mask[i]) {
                    return false;
                }
            }
            return true;
        }
        // Checks that only the specified bit is set for the given index
        only(n, offset, one) {
            for (let i = 0; i < this.subarrays; ++i) {
                if (this.subarrayData[i][n] != (i === offset ? one : 0)) {
                    return false;
                }
            }
            return true;
        }
        // Checks that only the specified bit is set for the given index except for possibly one other
        onlyExcept(n, offset, zero, onlyOffset, onlyOne) {
            let mask;
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
        orAt(offset, index, value) {
            this.subarrayData[offset][index] |= value;
        }
        xorAt(offset, index, value) {
            this.subarrayData[offset][index] ^= value;
        }
        andAt(offset, index, value) {
            this.subarrayData[offset][index] &= value;
        }
        getAt(offset, index) {
            return this.subarrayData[offset][index];
        }
    }
    const xfilterArray = {
        array8: typeof Uint8Array !== "undefined" ? (n) => new Uint8Array(n) : arrayUntyped,
        array16: typeof Uint16Array !== "undefined" ? (n) => new Uint16Array(n) : arrayUntyped,
        array32: typeof Uint32Array !== "undefined" ? (n) => new Uint32Array(n) : arrayUntyped,
        arrayLengthen: arrayLengthenUntyped,
        arrayWiden: arrayWidenUntyped,
        bitarray: Bitarray
    };

    const filterExact = (bisect, value) => {
        return (values) => {
            const n = values.length;
            return [bisect.left(values, value, 0, n), bisect.right(values, value, 0, n)];
        };
    };
    const filterRange = (bisect, range) => {
        const min = range[0];
        const max = range[1];
        return (values) => {
            const n = values.length;
            return [bisect.left(values, min, 0, n), bisect.left(values, max, 0, n)];
        };
    };
    const filterAll = (values) => {
        return [0, values.length];
    };
    var xfilterFilter = {
        filterExact,
        filterRange,
        filterAll
    };

    var cr_identity = (d) => {
        return d;
    };

    var cr_zero = () => {
        return 0;
    };

    function heap_by(f) {
        // Sifts the element a[lo+i-1] down the heap.
        function sift(a, i, n, lo) {
            const d = a[--lo + i];
            const x = f(d);
            let child;
            while ((child = i << 1) <= n) {
                if (child < n && f(a[lo + child]) > f(a[lo + child + 1]))
                    child++;
                if (x <= f(a[lo + child]))
                    break;
                a[lo + i] = a[lo + child];
                i = child;
            }
            a[lo + i] = d;
        }
        // Builds a binary heap within the specified array a[lo:hi].
        function heap(a, lo, hi) {
            const n = hi - lo;
            let i = (n >>> 1) + 1;
            while (--i > 0)
                sift(a, i, n, lo);
            return a;
        }
        // Sorts the specified array a[lo:hi] in descending order, assuming it is already a heap.
        function sort(a, lo, hi) {
            let n = hi - lo;
            let t;
            while (--n > 0) {
                t = a[lo];
                a[lo] = a[lo + n];
                a[lo + n] = t;
                sift(a, 1, n, lo);
            }
            return a;
        }
        // Create the result object
        function heapFn(a, lo, hi) {
            return heap(a, lo, hi);
        }
        heapFn.sort = sort;
        return heapFn;
    }
    // Create the default heap for numbers
    const identityNum$1 = (d) => d;
    const baseHeap = heap_by(identityNum$1);
    function heapFn(a, lo, hi) {
        return baseHeap(a, lo, hi);
    }
    heapFn.sort = baseHeap.sort;
    heapFn.by = heap_by;
    const h$1 = heapFn;

    function heapselect_by(f) {
        const heap = h$1.by(f);
        // Returns a new array containing the top k elements in the array a[lo:hi].
        function heapselect(a, lo, hi, k) {
            k = Math.min(hi - lo, k);
            const queue = new Array(k);
            let min;
            let i;
            let d;
            for (i = 0; i < k; ++i)
                queue[i] = a[lo++];
            heap(queue, 0, k);
            if (lo < hi) {
                min = f(queue[0]);
                do {
                    if (f(d = a[lo]) > min) {
                        queue[0] = d;
                        min = f(heap(queue, 0, k)[0]);
                    }
                } while (++lo < hi);
            }
            return queue;
        }
        return heapselect;
    }
    // Create the default heapselect for numbers
    const identityNum = (d) => d;
    const baseHeapselect = heapselect_by(identityNum);
    function heapselectFn(a, lo, hi, k) {
        return baseHeapselect(a, lo, hi, k);
    }
    heapselectFn.by = heapselect_by;
    const h = heapselectFn;

    const toComparableValue$1 = (value) => {
        if (value == null)
            return value;
        if (typeof value === 'object')
            return value.valueOf();
        return value;
    };
    const compare = (a, b) => {
        const av = toComparableValue$1(a);
        const bv = toComparableValue$1(b);
        if (typeof av === 'string' && typeof bv === 'string') {
            return av < bv ? -1 : av > bv ? 1 : 0;
        }
        const an = Number(av);
        const bn = Number(bv);
        return an < bn ? -1 : an > bn ? 1 : 0;
    };
    function bisect_by(f) {
        // Locate the insertion point for x in a to maintain sorted order.
        function bisectLeft(a, x, lo, hi) {
            while (lo < hi) {
                const mid = lo + hi >>> 1;
                if (compare(f(a[mid]), x) < 0)
                    lo = mid + 1;
                else
                    hi = mid;
            }
            return lo;
        }
        // Similar to bisectLeft, but returns an insertion point which comes after
        // any existing entries of x in a.
        function bisectRight(a, x, lo, hi) {
            while (lo < hi) {
                const mid = lo + hi >>> 1;
                if (compare(x, f(a[mid])) < 0)
                    hi = mid;
                else
                    lo = mid + 1;
            }
            return lo;
        }
        // bisector IS bisectRight with additional properties attached
        // Using Object.assign preserves the function identity (bisector === bisector.right)
        return Object.assign(bisectRight, {
            right: bisectRight,
            left: bisectLeft
        });
    }
    // For the default bisector, T = V (comparing values directly)
    // baseBisect IS the main function, with .right/.left/.by attached
    const baseBisect = bisect_by(cr_identity);
    const bisect = Object.assign(baseBisect, {
        by: bisect_by
    });

    var permute = (array, index, deep) => {
        const n = index.length;
        const copy = deep ? JSON.parse(JSON.stringify(Array.from(array))) : new Array(n);
        for (let i = 0; i < n; ++i) {
            copy[i] = array[index[i]];
        }
        return copy;
    };

    const reduceIncrement = (p, _v, _nf) => {
        return p + 1;
    };
    const reduceDecrement = (p, _v, _nf) => {
        return p - 1;
    };
    const reduceAdd = (f) => {
        return (p, v, _nf, _j) => {
            return p + +f(v);
        };
    };
    const reduceSubtract = (f) => {
        return (p, v, _nf, _j) => {
            return p - f(v);
        };
    };
    var xfilterReduce = {
        reduceIncrement,
        reduceDecrement,
        reduceAdd,
        reduceSubtract
    };

    function deep(t,e,i,n,r){for(r in n=(i=i.split(".")).splice(-1,1),i)e=e[i[r]]=e[i[r]]||{};return t(e,n)}

    function isFunction(value) {
        return typeof value === 'function';
    }
    const get = (obj, prop) => {
        const value = obj[prop];
        if (isFunction(value)) {
            return value.call(obj);
        }
        return value;
    };
    /**
     * get value of object at a deep path.
     * if the resolved value is a function,
     * it's invoked with the `this` binding of
     * its parent object and its result is returned.
     *
     * @param obj - the object (e.g. { 'a': [{ 'b': { 'c1': 3, 'c2': 4} }], 'd': {e:1} }; )
     * @param path - deep path (e.g. `d.e` or `a[0].b.c1`. Dot notation (a.0.b) is also supported)
     * @returns the resolved value
     */
    const reg = /\[([\w\d]+)\]/g;
    var result = (obj, path) => {
        return deep(get, obj, path.replace(reg, '.$1'));
    };

    // No-op functions matching listener signatures for use as placeholders
    const noopFilterListener = () => { };
    const noopReset = () => { };
    // constants
    const REMOVED_INDEX = -1;
    const toComparableValue = (value) => {
        if (value == null)
            return value;
        if (typeof value === 'object')
            return value.valueOf();
        return value;
    };
    const compareNaturallyOrdered = (a, b) => {
        const av = toComparableValue(a);
        const bv = toComparableValue(b);
        if (typeof av === 'string' && typeof bv === 'string') {
            return av < bv ? -1 : av > bv ? 1 : 0;
        }
        const an = Number(av);
        const bn = Number(bv);
        return an < bn ? -1 : an > bn ? 1 : 0;
    };
    const compareGroupKeys = (a, b) => {
        return compareNaturallyOrdered(a, b);
    };
    const isNaNValue = (value) => {
        const comparable = toComparableValue(value);
        if (comparable === undefined)
            return true;
        return typeof comparable === 'number' && Number.isNaN(comparable);
    };
    const crossfilter = function crossfilter(initialData) {
        const cf = {
            add: add,
            remove: removeData,
            dimension: dimension,
            groupAll: groupAll,
            size: size,
            all: all,
            allFiltered: allFiltered,
            onChange: onChange,
            isElementFiltered: isElementFiltered
        };
        let data = []; // the records
        let n = 0; // the number of records; data.length
        let filters; // 1 is filtered out
        const filterListeners = []; // when the filters change
        const dataListeners = []; // when data is added
        const removeDataListeners = []; // when data is removed
        const callbacks = [];
        filters = new xfilterArray.bitarray(0);
        // Adds the specified new records to this crossfilter.
        function add(newData) {
            const n0 = n;
            const n1 = newData.length;
            if (n1) {
                data = data.concat(newData);
                filters.lengthen(n += n1);
                dataListeners.forEach(function (l) { l(newData, n0, n1); });
                triggerOnChange('dataAdded');
            }
            return cf;
        }
        // Removes all records that match the current filters, or if a predicate function is passed,
        // removes all records matching the predicate (ignoring filters).
        function removeData(predicate) {
            const newIndex = new Array(n);
            const removed = [];
            const usePred = typeof predicate === 'function';
            const shouldRemove = (i) => {
                return usePred ? predicate(data[i], i) : filters.zero(i);
            };
            for (let index1 = 0, index2 = 0; index1 < n; ++index1) {
                if (shouldRemove(index1)) {
                    removed.push(index1);
                    newIndex[index1] = REMOVED_INDEX;
                }
                else {
                    newIndex[index1] = index2++;
                }
            }
            // Remove all matching records from groups.
            filterListeners.forEach(function (l) { l(-1, -1, [], removed, true); });
            // Update indexes.
            removeDataListeners.forEach(function (l) { l(newIndex); });
            // Remove old filters and data by overwriting.
            let index3, index4;
            for (index3 = 0, index4 = 0; index3 < n; ++index3) {
                if (newIndex[index3] !== REMOVED_INDEX) {
                    if (index3 !== index4) {
                        filters.copy(index4, index3);
                        data[index4] = data[index3];
                    }
                    ++index4;
                }
            }
            data.length = n = index4;
            filters.truncate(index4);
            triggerOnChange('dataRemoved');
        }
        function maskForDimensions(dimensions) {
            const mask = new Array(filters.subarrays);
            for (let i = 0; i < filters.subarrays; i++) {
                mask[i] = ~0;
            }
            for (let d = 0, len = dimensions.length; d < len; d++) {
                const id = dimensions[d].id();
                mask[id >> 7] &= ~(0x1 << (id & 0x3f));
            }
            return mask;
        }
        // Return true if the data element at index i is filtered IN.
        function isElementFiltered(i, ignore_dimensions) {
            const mask = maskForDimensions(ignore_dimensions || []);
            return filters.zeroExceptMask(i, mask);
        }
        function dimension(value, iterable) {
            function makeValueAccessor(accessor) {
                if (typeof accessor === 'string') {
                    const accessorPath = accessor;
                    return function (d) { return result(d, accessorPath); };
                }
                return accessor;
            }
            function isIterableValueAccessor(accessor, isIterable) {
                return isIterable === true;
            }
            let accessorFn;
            let iterableAccessor = null;
            let nonIterableAccessor = null;
            if (isIterableValueAccessor(value, iterable)) {
                iterableAccessor = makeValueAccessor(value);
                accessorFn = iterableAccessor;
            }
            else {
                nonIterableAccessor = makeValueAccessor(value);
                accessorFn = nonIterableAccessor;
            }
            const dim = {
                filter: filter,
                filterExact: filterExact,
                filterRange: filterRange,
                filterFunction: filterFunction,
                filterAll: filterAll,
                currentFilter: currentFilter,
                hasCurrentFilter: hasCurrentFilter,
                top: top,
                bottom: bottom,
                group: group,
                groupAll: dimGroupAll,
                dispose: dispose,
                remove: dispose,
                accessor: accessorFn,
                id: function () { return id; }
            };
            let one; // lowest unset bit as mask
            let zero; // inverted one
            let offset; // offset into the filters arrays
            let id; // unique ID for this dimension
            let values = []; // sorted, cached array
            let index = []; // maps sorted value index -> record index
            let newValues = []; // temporary array storing newly-added values
            let newIndex = []; // temporary array storing newly-added index
            let iterablesIndexCount = [];
            let iterablesIndexFilterStatus = [];
            let iterablesEmptyRows = [];
            const sortRange = function (n) {
                // Convert to regular array to ensure Array.prototype.sort signature
                return Array.from(cr_range(n)).sort(function (A, B) {
                    const cmp = compareNaturallyOrdered(newValues[A], newValues[B]);
                    return cmp !== 0 ? cmp : A - B;
                });
            };
            let refilter = xfilterFilter.filterAll;
            let refilterFunction = null;
            let filterValue;
            let filterValuePresent = false;
            let filterEverApplied = false;
            const indexListeners = [];
            const dimensionGroups = [];
            let lo0 = 0;
            let hi0 = 0;
            let t = 0;
            // Updating a dimension is a two-stage process.
            dataListeners.unshift(preAdd);
            dataListeners.push(postAdd);
            removeDataListeners.push(removeData);
            // Add a new dimension in the filter bitmap
            const tmp = filters.add();
            offset = tmp.offset;
            one = tmp.one;
            zero = ~one;
            // Create a unique ID for the dimension
            id = (offset << 7) | (Math.log(one) / Math.log(2));
            preAdd(data, 0, n);
            postAdd(data, 0, n);
            function preAdd(newData, n0, n1) {
                let newIterablesIndexCount = [];
                let newIterablesIndexFilterStatus = [];
                let i0;
                let j;
                const isIterable = iterable === true;
                if (isIterable) {
                    const valueAccessor = iterableAccessor;
                    if (!valueAccessor)
                        return;
                    t = 0;
                    for (i0 = 0; i0 < newData.length; i0++) {
                        const kArr = valueAccessor(newData[i0]);
                        for (j = 0; j < kArr.length; j++) {
                            t++;
                        }
                    }
                    newValues = [];
                    newIterablesIndexCount = cr_range(newData.length);
                    newIterablesIndexFilterStatus = cr_index(t, 1);
                    const unsortedIndex = cr_range(t);
                    for (let l = 0, index1 = 0; index1 < newData.length; index1++) {
                        const kArr = valueAccessor(newData[index1]);
                        if (!kArr.length) {
                            newIterablesIndexCount[index1] = 0;
                            iterablesEmptyRows.push(index1 + n0);
                            continue;
                        }
                        newIterablesIndexCount[index1] = kArr.length;
                        for (j = 0; j < kArr.length; j++) {
                            newValues.push(kArr[j]);
                            unsortedIndex[l] = index1;
                            l++;
                        }
                    }
                    const sortMap = sortRange(t);
                    newValues = permute(newValues, sortMap);
                    newIndex = permute(unsortedIndex, sortMap);
                }
                else {
                    const valueAccessor = nonIterableAccessor;
                    if (!valueAccessor)
                        return;
                    newValues = newData.map(valueAccessor);
                    newIndex = sortRange(n1);
                    newValues = permute(newValues, newIndex);
                }
                const bounds = refilter(newValues);
                let lo1 = bounds[0];
                let hi1 = bounds[1];
                let index2, index3, index4;
                if (isIterable) {
                    n1 = t;
                    if (refilterFunction) {
                        for (index2 = 0; index2 < n1; ++index2) {
                            if (!refilterFunction(newValues[index2], index2)) {
                                if (--newIterablesIndexCount[newIndex[index2]] === 0) {
                                    filters.orAt(offset, newIndex[index2] + n0, one);
                                }
                                newIterablesIndexFilterStatus[index2] = 1;
                            }
                        }
                    }
                    else {
                        for (index3 = 0; index3 < lo1; ++index3) {
                            if (--newIterablesIndexCount[newIndex[index3]] === 0) {
                                filters.orAt(offset, newIndex[index3] + n0, one);
                            }
                            newIterablesIndexFilterStatus[index3] = 1;
                        }
                        for (index4 = hi1; index4 < n1; ++index4) {
                            if (--newIterablesIndexCount[newIndex[index4]] === 0) {
                                filters.orAt(offset, newIndex[index4] + n0, one);
                            }
                            newIterablesIndexFilterStatus[index4] = 1;
                        }
                    }
                }
                else {
                    if (refilterFunction) {
                        for (index2 = 0; index2 < n1; ++index2) {
                            if (!refilterFunction(newValues[index2], index2)) {
                                filters.orAt(offset, newIndex[index2] + n0, one);
                            }
                        }
                    }
                    else {
                        for (index3 = 0; index3 < lo1; ++index3) {
                            filters.orAt(offset, newIndex[index3] + n0, one);
                        }
                        for (index4 = hi1; index4 < n1; ++index4) {
                            filters.orAt(offset, newIndex[index4] + n0, one);
                        }
                    }
                }
                if (!n0) {
                    values = newValues;
                    index = newIndex;
                    if (isIterable) {
                        iterablesIndexCount = newIterablesIndexCount;
                        iterablesIndexFilterStatus = newIterablesIndexFilterStatus;
                    }
                    lo0 = lo1;
                    hi0 = hi1;
                    return;
                }
                const oldValues = values;
                const oldIndex = index;
                const oldIterablesIndexFilterStatus = iterablesIndexFilterStatus;
                let old_n0 = 0;
                let i1 = 0;
                i0 = 0;
                if (iterable) {
                    old_n0 = n0;
                    n0 = oldValues.length;
                    n1 = t;
                }
                values = iterable ? new Array(n0 + n1) : new Array(n);
                index = iterable ? new Array(n0 + n1) : cr_index(n, n);
                if (iterable)
                    iterablesIndexFilterStatus = cr_index(n0 + n1, 1);
                if (iterable) {
                    const oldiiclength = iterablesIndexCount.length;
                    iterablesIndexCount = xfilterArray.arrayLengthen(iterablesIndexCount, n);
                    for (let j = 0; j + oldiiclength < n; j++) {
                        iterablesIndexCount[j + oldiiclength] = newIterablesIndexCount[j];
                    }
                }
                let index5 = 0;
                for (; i0 < n0 && i1 < n1; ++index5) {
                    if (compareNaturallyOrdered(oldValues[i0], newValues[i1]) < 0) {
                        values[index5] = oldValues[i0];
                        if (iterable)
                            iterablesIndexFilterStatus[index5] = oldIterablesIndexFilterStatus[i0];
                        index[index5] = oldIndex[i0++];
                    }
                    else {
                        values[index5] = newValues[i1];
                        if (iterable)
                            iterablesIndexFilterStatus[index5] = newIterablesIndexFilterStatus[i1];
                        index[index5] = newIndex[i1++] + (iterable ? old_n0 : n0);
                    }
                }
                for (; i0 < n0; ++i0, ++index5) {
                    values[index5] = oldValues[i0];
                    if (iterable)
                        iterablesIndexFilterStatus[index5] = oldIterablesIndexFilterStatus[i0];
                    index[index5] = oldIndex[i0];
                }
                for (; i1 < n1; ++i1, ++index5) {
                    values[index5] = newValues[i1];
                    if (iterable)
                        iterablesIndexFilterStatus[index5] = newIterablesIndexFilterStatus[i1];
                    index[index5] = newIndex[i1] + (iterable ? old_n0 : n0);
                }
                const bounds2 = refilter(values);
                lo0 = bounds2[0];
                hi0 = bounds2[1];
            }
            function postAdd(_newData, n0, n1) {
                indexListeners.forEach(function (l) { l(newValues, newIndex, n0, n1); });
                newValues = [];
                newIndex = [];
            }
            function removeData(reIndex) {
                let i0, i1;
                if (iterable) {
                    for (i0 = 0, i1 = 0; i0 < iterablesEmptyRows.length; i0++) {
                        if (reIndex[iterablesEmptyRows[i0]] !== REMOVED_INDEX) {
                            iterablesEmptyRows[i1] = reIndex[iterablesEmptyRows[i0]];
                            i1++;
                        }
                    }
                    iterablesEmptyRows.length = i1;
                    for (i0 = 0, i1 = 0; i0 < n; i0++) {
                        if (reIndex[i0] !== REMOVED_INDEX) {
                            if (i1 !== i0)
                                iterablesIndexCount[i1] = iterablesIndexCount[i0];
                            i1++;
                        }
                    }
                    iterablesIndexCount = iterablesIndexCount.slice(0, i1);
                }
                const n0 = values.length;
                let j = 0;
                let oldDataIndex;
                for (let i = 0; i < n0; ++i) {
                    oldDataIndex = index[i];
                    if (reIndex[oldDataIndex] !== REMOVED_INDEX) {
                        if (i !== j)
                            values[j] = values[i];
                        index[j] = reIndex[oldDataIndex];
                        if (iterable) {
                            iterablesIndexFilterStatus[j] = iterablesIndexFilterStatus[i];
                        }
                        ++j;
                    }
                }
                values.length = j;
                if (iterable)
                    iterablesIndexFilterStatus = iterablesIndexFilterStatus.slice(0, j);
                while (j < n0)
                    index[j++] = 0;
                const bounds = refilter(values);
                lo0 = bounds[0];
                hi0 = bounds[1];
            }
            function filterIndexBounds(bounds) {
                const lo1 = bounds[0];
                const hi1 = bounds[1];
                if (refilterFunction) {
                    refilterFunction = null;
                    filterIndexFunction(function (_d, i) { return lo1 <= i && i < hi1; }, bounds[0] === 0 && bounds[1] === values.length);
                    lo0 = lo1;
                    hi0 = hi1;
                    return dim;
                }
                let i;
                let j;
                let kIdx;
                const added = [];
                const removed = [];
                const valueIndexAdded = [];
                const valueIndexRemoved = [];
                if (lo1 < lo0) {
                    for (i = lo1, j = Math.min(lo0, hi1); i < j; ++i) {
                        added.push(index[i]);
                        valueIndexAdded.push(i);
                    }
                }
                else if (lo1 > lo0) {
                    for (i = lo0, j = Math.min(lo1, hi0); i < j; ++i) {
                        removed.push(index[i]);
                        valueIndexRemoved.push(i);
                    }
                }
                if (hi1 > hi0) {
                    for (i = Math.max(lo1, hi0), j = hi1; i < j; ++i) {
                        added.push(index[i]);
                        valueIndexAdded.push(i);
                    }
                }
                else if (hi1 < hi0) {
                    for (i = Math.max(lo0, hi1), j = hi0; i < j; ++i) {
                        removed.push(index[i]);
                        valueIndexRemoved.push(i);
                    }
                }
                let finalAdded = added;
                let finalRemoved = removed;
                if (!iterable) {
                    for (i = 0; i < added.length; i++) {
                        filters.xorAt(offset, added[i], one);
                    }
                    for (i = 0; i < removed.length; i++) {
                        filters.xorAt(offset, removed[i], one);
                    }
                }
                else {
                    const newAdded = [];
                    const newRemoved = [];
                    for (i = 0; i < added.length; i++) {
                        iterablesIndexCount[added[i]]++;
                        iterablesIndexFilterStatus[valueIndexAdded[i]] = 0;
                        if (iterablesIndexCount[added[i]] === 1) {
                            filters.xorAt(offset, added[i], one);
                            newAdded.push(added[i]);
                        }
                    }
                    for (i = 0; i < removed.length; i++) {
                        iterablesIndexCount[removed[i]]--;
                        iterablesIndexFilterStatus[valueIndexRemoved[i]] = 1;
                        if (iterablesIndexCount[removed[i]] === 0) {
                            filters.xorAt(offset, removed[i], one);
                            newRemoved.push(removed[i]);
                        }
                    }
                    finalAdded = newAdded;
                    finalRemoved = newRemoved;
                    if (refilter === xfilterFilter.filterAll) {
                        for (i = 0; i < iterablesEmptyRows.length; i++) {
                            kIdx = iterablesEmptyRows[i];
                            if ((filters.getAt(offset, kIdx) & one)) {
                                filters.xorAt(offset, kIdx, one);
                                finalAdded.push(kIdx);
                            }
                        }
                    }
                    else {
                        for (i = 0; i < iterablesEmptyRows.length; i++) {
                            kIdx = iterablesEmptyRows[i];
                            if (!(filters.getAt(offset, kIdx) & one)) {
                                filters.xorAt(offset, kIdx, one);
                                finalRemoved.push(kIdx);
                            }
                        }
                    }
                }
                lo0 = lo1;
                hi0 = hi1;
                filterListeners.forEach(function (l) { l(one, offset, finalAdded, finalRemoved); });
                triggerOnChange('filtered');
                return dim;
            }
            function filter(range) {
                if (range == null)
                    return filterAll();
                if (Array.isArray(range))
                    return filterRange(range);
                if (typeof range === 'function')
                    return filterFunction(range);
                return filterExact(range);
            }
            function filterExact(value) {
                filterValue = value;
                filterValuePresent = true;
                filterEverApplied = true;
                return filterIndexBounds((refilter = xfilterFilter.filterExact(bisect, value))(values));
            }
            function filterRange(range) {
                filterValue = range;
                filterValuePresent = true;
                filterEverApplied = true;
                return filterIndexBounds((refilter = xfilterFilter.filterRange(bisect, range))(values));
            }
            function filterAll() {
                filterValue = undefined;
                filterValuePresent = false;
                return filterIndexBounds((refilter = xfilterFilter.filterAll)(values));
            }
            function filterFunction(f) {
                // Store original function for currentFilter() to return
                filterValue = f;
                filterValuePresent = true;
                filterEverApplied = true;
                refilterFunction = f;
                refilter = xfilterFilter.filterAll;
                filterIndexFunction(f, false);
                const bounds = refilter(values);
                lo0 = bounds[0];
                hi0 = bounds[1];
                return dim;
            }
            function filterIndexFunction(f, filterAll) {
                let i;
                let kIdx;
                let x;
                let added = [];
                let removed = [];
                const valueIndexAdded = [];
                const valueIndexRemoved = [];
                const indexLength = values.length;
                if (!iterable) {
                    for (i = 0; i < indexLength; ++i) {
                        kIdx = index[i];
                        if (!((filters.getAt(offset, kIdx) & one) !== 0) !== !!(x = f(values[i], i))) {
                            if (x)
                                added.push(kIdx);
                            else
                                removed.push(kIdx);
                        }
                    }
                }
                if (iterable) {
                    for (i = 0; i < indexLength; ++i) {
                        if (f(values[i], i)) {
                            added.push(index[i]);
                            valueIndexAdded.push(i);
                        }
                        else {
                            removed.push(index[i]);
                            valueIndexRemoved.push(i);
                        }
                    }
                }
                if (!iterable) {
                    for (i = 0; i < added.length; i++) {
                        if (filters.getAt(offset, added[i]) & one)
                            filters.andAt(offset, added[i], zero);
                    }
                    for (i = 0; i < removed.length; i++) {
                        if (!(filters.getAt(offset, removed[i]) & one))
                            filters.orAt(offset, removed[i], one);
                    }
                }
                else {
                    const newAdded = [];
                    const newRemoved = [];
                    for (i = 0; i < added.length; i++) {
                        if (iterablesIndexFilterStatus[valueIndexAdded[i]] === 1) {
                            iterablesIndexCount[added[i]]++;
                            iterablesIndexFilterStatus[valueIndexAdded[i]] = 0;
                            if (iterablesIndexCount[added[i]] === 1) {
                                filters.xorAt(offset, added[i], one);
                                newAdded.push(added[i]);
                            }
                        }
                    }
                    for (i = 0; i < removed.length; i++) {
                        if (iterablesIndexFilterStatus[valueIndexRemoved[i]] === 0) {
                            iterablesIndexCount[removed[i]]--;
                            iterablesIndexFilterStatus[valueIndexRemoved[i]] = 1;
                            if (iterablesIndexCount[removed[i]] === 0) {
                                filters.xorAt(offset, removed[i], one);
                                newRemoved.push(removed[i]);
                            }
                        }
                    }
                    added = newAdded;
                    removed = newRemoved;
                    if (filterAll) {
                        for (i = 0; i < iterablesEmptyRows.length; i++) {
                            kIdx = iterablesEmptyRows[i];
                            if ((filters.getAt(offset, kIdx) & one)) {
                                filters.xorAt(offset, kIdx, one);
                                added.push(kIdx);
                            }
                        }
                    }
                    else {
                        for (i = 0; i < iterablesEmptyRows.length; i++) {
                            kIdx = iterablesEmptyRows[i];
                            if (!(filters.getAt(offset, kIdx) & one)) {
                                filters.xorAt(offset, kIdx, one);
                                removed.push(kIdx);
                            }
                        }
                    }
                }
                filterListeners.forEach(function (l) { l(one, offset, added, removed); });
                triggerOnChange('filtered');
            }
            function currentFilter() {
                return filterValue;
            }
            function hasCurrentFilter() {
                if (!filterEverApplied)
                    return undefined;
                return filterValuePresent;
            }
            function top(k, top_offset) {
                const array = [];
                let i = hi0;
                let j;
                let toSkip = 0;
                if (top_offset && top_offset > 0)
                    toSkip = top_offset;
                while (--i >= lo0 && k > 0) {
                    if (filters.zero(j = index[i])) {
                        if (toSkip > 0) {
                            --toSkip;
                        }
                        else {
                            array.push(data[j]);
                            --k;
                        }
                    }
                }
                if (iterable) {
                    for (i = 0; i < iterablesEmptyRows.length && k > 0; i++) {
                        if (filters.zero(j = iterablesEmptyRows[i])) {
                            if (toSkip > 0) {
                                --toSkip;
                            }
                            else {
                                array.push(data[j]);
                                --k;
                            }
                        }
                    }
                }
                return array;
            }
            function bottom(k, bottom_offset) {
                const array = [];
                let i;
                let j;
                let toSkip = 0;
                if (bottom_offset && bottom_offset > 0)
                    toSkip = bottom_offset;
                if (iterable) {
                    for (i = 0; i < iterablesEmptyRows.length && k > 0; i++) {
                        if (filters.zero(j = iterablesEmptyRows[i])) {
                            if (toSkip > 0) {
                                --toSkip;
                            }
                            else {
                                array.push(data[j]);
                                --k;
                            }
                        }
                    }
                }
                i = lo0;
                while (i < hi0 && k > 0) {
                    if (filters.zero(j = index[i])) {
                        if (toSkip > 0) {
                            --toSkip;
                        }
                        else {
                            array.push(data[j]);
                            --k;
                        }
                    }
                    i++;
                }
                return array;
            }
            function group(key) {
                if (key)
                    return createGroup(key, false);
                const identityKey = (value) => value;
                return createGroup(identityKey, false);
            }
            function hasValue(value) {
                return value !== undefined;
            }
            function createGroup(keyFn, groupAllFlag, groupAllKey) {
                const grp = {
                    top: groupTop,
                    all: groupAll,
                    reduce: reduce,
                    reduceCount: reduceCount,
                    reduceSum: reduceSum,
                    order: order,
                    orderNatural: orderNatural,
                    size: groupSize,
                    dispose: groupDispose,
                    remove: groupDispose
                };
                dimensionGroups.push(grp);
                let groups = [];
                let groupIndex = { kind: '1d', data: [] };
                let groupWidth = 8;
                let groupCapacity = capacity(groupWidth);
                let kVal = 0;
                let select = h.by((d) => d.value);
                let heap = h$1.by((d) => d.value);
                let reduceAdd = xfilterReduce.reduceIncrement;
                let reduceRemove = xfilterReduce.reduceDecrement;
                let reduceInitial = cr_zero;
                let update = noopFilterListener;
                let reset = noopReset;
                let resetNeeded = true;
                let n0old = 0;
                filterListeners.push(update);
                indexListeners.push(addToGroup);
                removeDataListeners.push(removeGroupData);
                addToGroup(values, index, 0, n);
                function addToGroup(newValues, newIndex, n0, n1) {
                    if (iterable) {
                        n0old = n0;
                        n0 = values.length - newValues.length;
                        n1 = newValues.length;
                    }
                    const oldGroups = groups;
                    let reIndex = iterable ? [] : cr_index(kVal, groupCapacity);
                    const k0 = kVal;
                    let i0 = 0;
                    let i1 = 0;
                    let j;
                    let g0;
                    let x0;
                    let x1;
                    groups = new Array(kVal);
                    kVal = 0;
                    if (iterable) {
                        groupIndex = k0 && groupIndex.kind === '2d'
                            ? groupIndex
                            : { kind: '2d', data: [] };
                    }
                    else {
                        groupIndex = k0 > 1 && groupIndex.kind === '1d'
                            ? lengthenGroupIndex(groupIndex, n)
                            : { kind: '1d', data: cr_index(n, groupCapacity) };
                    }
                    if (k0) {
                        g0 = oldGroups[0];
                        x0 = g0.key;
                    }
                    while (i1 < n1) {
                        x1 = keyFn(newValues[i1]);
                        if (!isNaNValue(x1))
                            break;
                        i1++;
                    }
                    while (i1 < n1 && x1 !== undefined) {
                        let g;
                        let x;
                        if (g0 && x0 !== undefined && compareGroupKeys(x0, x1) <= 0) {
                            g = g0;
                            x = x0;
                            reIndex[i0] = kVal;
                            g0 = oldGroups[++i0];
                            if (g0)
                                x0 = g0.key;
                        }
                        else {
                            g = { key: x1, value: reduceInitial() };
                            x = x1;
                        }
                        groups[kVal] = g;
                        while (compareGroupKeys(x1, x) <= 0) {
                            j = newIndex[i1] + (iterable ? n0old : n0);
                            if (groupIndex.kind === '2d') {
                                if (groupIndex.data[j]) {
                                    groupIndex.data[j].push(kVal);
                                }
                                else {
                                    groupIndex.data[j] = [kVal];
                                }
                            }
                            else {
                                groupIndex.data[j] = kVal;
                            }
                            if (!resetNeeded) {
                                g.value = reduceAdd(g.value, data[j], true);
                                if (!filters.zeroExcept(j, offset, zero))
                                    g.value = reduceRemove(g.value, data[j], false);
                            }
                            i1++;
                            if (i1 >= n1)
                                break;
                            x1 = keyFn(newValues[i1]);
                            while (i1 < n1 && isNaNValue(x1)) {
                                i1++;
                                if (i1 >= n1)
                                    break;
                                x1 = keyFn(newValues[i1]);
                            }
                            if (i1 >= n1)
                                break;
                        }
                        groupIncrement();
                    }
                    while (i0 < k0) {
                        groups[reIndex[i0] = kVal] = oldGroups[i0++];
                        groupIncrement();
                    }
                    if (groupIndex.kind === '2d') {
                        for (let index1 = 0; index1 < n; index1++) {
                            if (!groupIndex.data[index1]) {
                                groupIndex.data[index1] = [];
                            }
                        }
                    }
                    if (kVal > i0) {
                        if (groupIndex.kind === '2d') {
                            for (i0 = 0; i0 < n0old; ++i0) {
                                for (let index1 = 0; index1 < groupIndex.data[i0].length; index1++) {
                                    groupIndex.data[i0][index1] = reIndex[groupIndex.data[i0][index1]];
                                }
                            }
                        }
                        else {
                            for (i0 = 0; i0 < n0; ++i0) {
                                groupIndex.data[i0] = reIndex[groupIndex.data[i0]];
                            }
                        }
                    }
                    j = filterListeners.indexOf(update);
                    if (kVal > 1 || iterable) {
                        update = updateMany;
                        reset = resetMany;
                    }
                    else {
                        if (!kVal && groupAllFlag && hasValue(groupAllKey)) {
                            kVal = 1;
                            groups = [{ key: groupAllKey, value: reduceInitial() }];
                        }
                        if (kVal === 1) {
                            update = updateOne;
                            reset = resetOne;
                        }
                        else {
                            update = noopFilterListener;
                            reset = noopReset;
                        }
                        groupIndex = { kind: '1d', data: [] };
                    }
                    filterListeners[j] = update;
                    function groupIncrement() {
                        if (iterable) {
                            kVal++;
                            return;
                        }
                        if (++kVal === groupCapacity) {
                            reIndex = xfilterArray.arrayWiden(reIndex, groupWidth <<= 1);
                            groupIndex = widenGroupIndex(groupIndex, groupWidth);
                            groupCapacity = capacity(groupWidth);
                        }
                    }
                }
                function removeGroupData(reIndex) {
                    if (kVal > 1 || iterable) {
                        const oldK = kVal;
                        const oldGroups = groups;
                        const seenGroups = cr_index(oldK, oldK);
                        let i;
                        let i0;
                        let j;
                        if (groupIndex.kind === '1d') {
                            for (i = 0, j = 0; i < n; ++i) {
                                if (reIndex[i] !== REMOVED_INDEX) {
                                    seenGroups[groupIndex.data[j] = groupIndex.data[i]] = 1;
                                    ++j;
                                }
                            }
                        }
                        else {
                            for (i = 0, j = 0; i < n; ++i) {
                                if (reIndex[i] !== REMOVED_INDEX) {
                                    groupIndex.data[j] = groupIndex.data[i];
                                    for (i0 = 0; i0 < groupIndex.data[j].length; i0++) {
                                        seenGroups[groupIndex.data[j][i0]] = 1;
                                    }
                                    ++j;
                                }
                            }
                            groupIndex = { kind: '2d', data: groupIndex.data.slice(0, j) };
                        }
                        groups = [];
                        kVal = 0;
                        for (i = 0; i < oldK; ++i) {
                            if (seenGroups[i]) {
                                seenGroups[i] = kVal++;
                                groups.push(oldGroups[i]);
                            }
                        }
                        if (kVal > 1 || iterable) {
                            if (groupIndex.kind === '1d') {
                                for (i = 0; i < j; ++i)
                                    groupIndex.data[i] = seenGroups[groupIndex.data[i]];
                            }
                            else {
                                for (i = 0; i < j; ++i) {
                                    for (i0 = 0; i0 < groupIndex.data[i].length; ++i0) {
                                        groupIndex.data[i][i0] = seenGroups[groupIndex.data[i][i0]];
                                    }
                                }
                            }
                        }
                        filterListeners[filterListeners.indexOf(update)] = kVal > 1 || iterable
                            ? (reset = resetMany, update = updateMany)
                            : kVal === 1 ? (reset = resetOne, update = updateOne)
                                : (reset = noopReset, update = noopFilterListener);
                    }
                    else if (kVal === 1) {
                        if (groupAllFlag)
                            return;
                        for (let index3 = 0; index3 < n; ++index3)
                            if (reIndex[index3] !== REMOVED_INDEX)
                                return;
                        groups = [];
                        kVal = 0;
                        reset = noopReset;
                        filterListeners[filterListeners.indexOf(update)] = update = noopFilterListener;
                    }
                }
                function updateMany(filterOne, filterOffset, added, removed, notFilter) {
                    if ((filterOne === one && filterOffset === offset) || resetNeeded)
                        return;
                    const notFilterValue = notFilter === true;
                    let i;
                    let j;
                    let kIdx;
                    let nLen;
                    let g;
                    if (groupIndex.kind === '2d') {
                        for (i = 0, nLen = added.length; i < nLen; ++i) {
                            if (filters.zeroExcept(kIdx = added[i], offset, zero)) {
                                for (j = 0; j < groupIndex.data[kIdx].length; j++) {
                                    g = groups[groupIndex.data[kIdx][j]];
                                    g.value = reduceAdd(g.value, data[kIdx], false, j);
                                }
                            }
                        }
                        for (i = 0, nLen = removed.length; i < nLen; ++i) {
                            if (filters.onlyExcept(kIdx = removed[i], offset, zero, filterOffset, filterOne)) {
                                for (j = 0; j < groupIndex.data[kIdx].length; j++) {
                                    g = groups[groupIndex.data[kIdx][j]];
                                    g.value = reduceRemove(g.value, data[kIdx], notFilterValue, j);
                                }
                            }
                        }
                        return;
                    }
                    for (i = 0, nLen = added.length; i < nLen; ++i) {
                        if (filters.zeroExcept(kIdx = added[i], offset, zero)) {
                            g = groups[groupIndex.data[kIdx]];
                            g.value = reduceAdd(g.value, data[kIdx], false);
                        }
                    }
                    for (i = 0, nLen = removed.length; i < nLen; ++i) {
                        if (filters.onlyExcept(kIdx = removed[i], offset, zero, filterOffset, filterOne)) {
                            g = groups[groupIndex.data[kIdx]];
                            g.value = reduceRemove(g.value, data[kIdx], notFilterValue);
                        }
                    }
                }
                function updateOne(filterOne, filterOffset, added, removed, notFilter) {
                    if ((filterOne === one && filterOffset === offset) || resetNeeded)
                        return;
                    const notFilterValue = notFilter === true;
                    let i;
                    let kIdx;
                    let nLen;
                    const g = groups[0];
                    for (i = 0, nLen = added.length; i < nLen; ++i) {
                        if (filters.zeroExcept(kIdx = added[i], offset, zero)) {
                            g.value = reduceAdd(g.value, data[kIdx], false);
                        }
                    }
                    for (i = 0, nLen = removed.length; i < nLen; ++i) {
                        if (filters.onlyExcept(kIdx = removed[i], offset, zero, filterOffset, filterOne)) {
                            g.value = reduceRemove(g.value, data[kIdx], notFilterValue);
                        }
                    }
                }
                function resetMany() {
                    let i;
                    let j;
                    let g;
                    for (i = 0; i < kVal; ++i) {
                        groups[i].value = reduceInitial();
                    }
                    if (groupIndex.kind === '2d') {
                        for (i = 0; i < n; ++i) {
                            for (j = 0; j < groupIndex.data[i].length; j++) {
                                g = groups[groupIndex.data[i][j]];
                                g.value = reduceAdd(g.value, data[i], true, j);
                            }
                        }
                        for (i = 0; i < n; ++i) {
                            if (!filters.zeroExcept(i, offset, zero)) {
                                for (j = 0; j < groupIndex.data[i].length; j++) {
                                    g = groups[groupIndex.data[i][j]];
                                    g.value = reduceRemove(g.value, data[i], false, j);
                                }
                            }
                        }
                        return;
                    }
                    for (i = 0; i < n; ++i) {
                        g = groups[groupIndex.data[i]];
                        g.value = reduceAdd(g.value, data[i], true);
                    }
                    for (i = 0; i < n; ++i) {
                        if (!filters.zeroExcept(i, offset, zero)) {
                            g = groups[groupIndex.data[i]];
                            g.value = reduceRemove(g.value, data[i], false);
                        }
                    }
                }
                function resetOne() {
                    let i;
                    const g = groups[0];
                    g.value = reduceInitial();
                    for (i = 0; i < n; ++i) {
                        g.value = reduceAdd(g.value, data[i], true);
                    }
                    for (i = 0; i < n; ++i) {
                        if (!filters.zeroExcept(i, offset, zero)) {
                            g.value = reduceRemove(g.value, data[i], false);
                        }
                    }
                }
                function groupAll() {
                    if (resetNeeded) {
                        reset();
                        resetNeeded = false;
                    }
                    return groups;
                }
                function groupTop(k) {
                    const top = select(groupAll(), 0, groups.length, k);
                    return heap.sort(top, 0, top.length);
                }
                function reduce(add, remove, initial) {
                    reduceAdd = add;
                    reduceRemove = remove;
                    reduceInitial = initial;
                    resetNeeded = true;
                    return grp;
                }
                function reduceCount() {
                    return reduce(xfilterReduce.reduceIncrement, xfilterReduce.reduceDecrement, cr_zero);
                }
                function reduceSum(value) {
                    return reduce(xfilterReduce.reduceAdd(value), xfilterReduce.reduceSubtract(value), cr_zero);
                }
                function order(value) {
                    select = h.by(valueOf);
                    heap = h$1.by(valueOf);
                    function valueOf(d) { return value(d.value); }
                    return grp;
                }
                function orderNatural() {
                    return order(cr_identity);
                }
                function groupSize() {
                    return kVal;
                }
                function groupDispose() {
                    let i = filterListeners.indexOf(update);
                    if (i >= 0)
                        filterListeners.splice(i, 1);
                    i = indexListeners.indexOf(addToGroup);
                    if (i >= 0)
                        indexListeners.splice(i, 1);
                    i = removeDataListeners.indexOf(removeGroupData);
                    if (i >= 0)
                        removeDataListeners.splice(i, 1);
                    i = dimensionGroups.indexOf(grp);
                    if (i >= 0)
                        dimensionGroups.splice(i, 1);
                    return grp;
                }
                return reduceCount().orderNatural();
            }
            function dimGroupAll() {
                const nullKey = (_value) => null;
                const base = createGroup(nullKey, true, null);
                const groupAll = {
                    reduce: function (add, remove, initial) {
                        base.reduce(add, remove, initial);
                        return groupAll;
                    },
                    reduceCount: function () {
                        base.reduceCount();
                        return groupAll;
                    },
                    reduceSum: function (value) {
                        base.reduceSum(value);
                        return groupAll;
                    },
                    value: function () {
                        const all = base.all();
                        return all.length ? all[0].value : 0;
                    },
                    dispose: function () {
                        base.dispose();
                        return groupAll;
                    },
                    remove: function () {
                        base.remove();
                        return groupAll;
                    }
                };
                return groupAll;
            }
            function dispose() {
                dimensionGroups.forEach(function (group) { group.dispose(); });
                let i = dataListeners.indexOf(preAdd);
                if (i >= 0)
                    dataListeners.splice(i, 1);
                i = dataListeners.indexOf(postAdd);
                if (i >= 0)
                    dataListeners.splice(i, 1);
                i = removeDataListeners.indexOf(removeData);
                if (i >= 0)
                    removeDataListeners.splice(i, 1);
                filters.masks[offset] &= zero;
                return filterAll();
            }
            return dim;
        }
        function groupAll() {
            const grp = {
                reduce: reduce,
                reduceCount: reduceCount,
                reduceSum: reduceSum,
                value: value,
                dispose: dispose,
                remove: dispose
            };
            let reduceValue = 0;
            let reduceAdd = xfilterReduce.reduceIncrement;
            let reduceRemove = xfilterReduce.reduceDecrement;
            let reduceInitial = cr_zero;
            let resetNeeded = true;
            filterListeners.push(update);
            dataListeners.push(add);
            add(data, 0);
            function add(newData, n0, _n1) {
                let i;
                if (resetNeeded)
                    return;
                for (i = n0; i < n; ++i) {
                    reduceValue = reduceAdd(reduceValue, data[i], true);
                    if (!filters.zero(i)) {
                        reduceValue = reduceRemove(reduceValue, data[i], false);
                    }
                }
            }
            function update(filterOne, filterOffset, added, removed, notFilter) {
                const notFilterValue = notFilter === true;
                let i;
                let kIdx;
                let nLen;
                if (resetNeeded)
                    return;
                for (i = 0, nLen = added.length; i < nLen; ++i) {
                    if (filters.zero(kIdx = added[i])) {
                        reduceValue = reduceAdd(reduceValue, data[kIdx], notFilterValue);
                    }
                }
                for (i = 0, nLen = removed.length; i < nLen; ++i) {
                    if (filters.only(kIdx = removed[i], filterOffset, filterOne)) {
                        reduceValue = reduceRemove(reduceValue, data[kIdx], notFilterValue);
                    }
                }
            }
            function reset() {
                let i;
                reduceValue = reduceInitial();
                for (i = 0; i < n; ++i) {
                    reduceValue = reduceAdd(reduceValue, data[i], true);
                    if (!filters.zero(i)) {
                        reduceValue = reduceRemove(reduceValue, data[i], false);
                    }
                }
            }
            function reduce(add, remove, initial) {
                reduceAdd = add;
                reduceRemove = remove;
                reduceInitial = initial;
                resetNeeded = true;
                return grp;
            }
            function reduceCount() {
                return reduce(xfilterReduce.reduceIncrement, xfilterReduce.reduceDecrement, cr_zero);
            }
            function reduceSum(value) {
                return reduce(xfilterReduce.reduceAdd(value), xfilterReduce.reduceSubtract(value), cr_zero);
            }
            function value() {
                if (resetNeeded) {
                    reset();
                    resetNeeded = false;
                }
                return reduceValue;
            }
            function dispose() {
                let i = filterListeners.indexOf(update);
                if (i >= 0)
                    filterListeners.splice(i, 1);
                i = dataListeners.indexOf(add);
                if (i >= 0)
                    dataListeners.splice(i, 1);
                return grp;
            }
            return reduceCount();
        }
        function size() {
            return n;
        }
        function all() {
            return data;
        }
        function allFiltered(ignore_dimensions) {
            const array = [];
            const mask = maskForDimensions(ignore_dimensions || []);
            for (let i = 0; i < n; i++) {
                if (filters.zeroExceptMask(i, mask)) {
                    array.push(data[i]);
                }
            }
            return array;
        }
        function onChange(cb) {
            if (typeof cb !== 'function') {
                console.warn('onChange callback parameter must be a function!');
                return () => { };
            }
            callbacks.push(cb);
            return function () {
                callbacks.splice(callbacks.indexOf(cb), 1);
            };
        }
        function triggerOnChange(eventName) {
            for (let i = 0; i < callbacks.length; i++) {
                callbacks[i](eventName);
            }
        }
        return initialData !== undefined ? add(initialData) : cf;
    };
    crossfilter.heap = h$1;
    crossfilter.heapselect = h;
    crossfilter.bisect = bisect;
    crossfilter.permute = permute;
    // Helper functions
    function cr_index(n, m) {
        return (m < 0x101
            ? xfilterArray.array8 : m < 0x10001
            ? xfilterArray.array16
            : xfilterArray.array32)(n);
    }
    function cr_range(n) {
        const range = cr_index(n, n);
        for (let i = -1; ++i < n;)
            range[i] = i;
        return range;
    }
    function capacity(w) {
        return w === 8
            ? 0x100 : w === 16
            ? 0x10000
            : 0x100000000;
    }
    // Lengthen a 1D GroupIndex
    function lengthenGroupIndex(gi, n) {
        if (gi.kind === '1d') {
            return { kind: '1d', data: xfilterArray.arrayLengthen(gi.data, n) };
        }
        // 2D array - return unchanged
        return gi;
    }
    // Widen a 1D GroupIndex
    function widenGroupIndex(gi, width) {
        if (gi.kind === '1d') {
            return { kind: '1d', data: xfilterArray.arrayWiden(gi.data, width) };
        }
        // 2D array - return unchanged
        return gi;
    }

    var name = "crossfilter2";
    var version = "1.5.4";
    var description = "Fast multidimensional filtering for coordinated views.";
    var license = "Apache-2.0";
    var keywords = [
    	"analytics",
    	"visualization",
    	"crossfilter"
    ];
    var author = {
    	name: "Mike Bostock",
    	url: "http://bost.ocks.org/mike"
    };
    var contributors = [
    	{
    		name: "Jason Davies",
    		url: "http://www.jasondavies.com/"
    	}
    ];
    var maintainers = [
    	{
    		name: "Gordon Woodhull",
    		url: "https://github.com/gordonwoodhull"
    	},
    	{
    		name: "Tanner Linsley",
    		url: "https://github.com/tannerlinsley"
    	},
    	{
    		name: "Ethan Jewett",
    		url: "https://github.com/esjewett"
    	}
    ];
    var homepage = "https://crossfilter.github.io/crossfilter/";
    var main = "./crossfilter.js";
    var module = "main.ts";
    var types = "./index.d.ts";
    var unpkg = "./crossfilter.min.js";
    var repository = {
    	type: "git",
    	url: "http://github.com/crossfilter/crossfilter.git"
    };
    var type = "module";
    var dependencies = {
    	"@ranfdev/deepobj": "1.0.2"
    };
    var devDependencies = {
    	"@rollup/plugin-typescript": "^12.3.0",
    	d3: "^3.5.17",
    	eslint: "^8.12.0",
    	"package-json-versionify": "1.0.2",
    	rollup: "^2.78.1",
    	"rollup-plugin-commonjs": "^10.1.0",
    	"rollup-plugin-json": "4",
    	"rollup-plugin-node-resolve": "5",
    	"rollup-plugin-terser": "^7.0.2",
    	semver: "^5.7.0",
    	sinon: "^7.5.0",
    	tslib: "^2.8.1",
    	typescript: "^5.9.3",
    	vitest: "^0.22.1"
    };
    var scripts = {
    	benchmark: "node test/benchmark.js",
    	build: "rollup -c rollup.config.js",
    	clean: "rm -f crossfilter.js crossfilter.min.js",
    	test: "vitest run",
    	typecheck: "tsc --noEmit"
    };
    var files = [
    	"index.ts",
    	"main.ts",
    	"src/**/*.ts",
    	"index.d.ts",
    	"crossfilter.js",
    	"crossfilter.min.js"
    ];
    var pkg = {
    	name: name,
    	version: version,
    	description: description,
    	license: license,
    	keywords: keywords,
    	author: author,
    	contributors: contributors,
    	maintainers: maintainers,
    	homepage: homepage,
    	main: main,
    	module: module,
    	types: types,
    	unpkg: unpkg,
    	repository: repository,
    	type: type,
    	dependencies: dependencies,
    	devDependencies: devDependencies,
    	scripts: scripts,
    	files: files
    };

    // Note(cg): exporting current version for umd build.
    crossfilter.version = pkg.version;

    return crossfilter;

}));
