function arrayLengthen(array, length) {
    if (array.length >= length)
        return array;
    const copy = array instanceof Uint8Array
        ? new Uint8Array(length)
        : array instanceof Uint16Array
            ? new Uint16Array(length)
            : new Uint32Array(length);
    copy.set(array);
    return copy;
}
function arrayWiden(array, width) {
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
function arrayUntyped(n) {
    const array = new Array(n);
    let i = -1;
    while (++i < n)
        array[i] = 0;
    return array;
}
function arrayLengthenUntyped(array, length) {
    let n = array.length;
    while (n < length)
        array[n++] = 0;
    return array;
}
function arrayWidenUntyped(array, width) {
    if (width > 32)
        throw new Error("invalid array width!");
    return array;
}
class BitArray {
    length;
    subarrays = 1;
    width = 8;
    masks = { 0: 0 };
    constructor(n) {
        this.length = n;
        this[0] = new Uint8Array(n);
    }
    lengthen(n) {
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
            if (width >= 32 && !one)
                continue;
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
    copy(dest, src) {
        for (let i = 0, len = this.subarrays; i < len; ++i) {
            this[i][dest] = this[i][src];
        }
    }
    truncate(n) {
        for (let i = 0, len = this.subarrays; i < len; ++i) {
            for (let j = this.length - 1; j >= n; j--)
                this[i][j] = 0;
        }
        this.length = n;
    }
    zero(n) {
        for (let i = 0, len = this.subarrays; i < len; ++i) {
            if (this[i][n])
                return false;
        }
        return true;
    }
    zeroExcept(n, offset, zero) {
        for (let i = 0, len = this.subarrays; i < len; ++i) {
            if (i === offset ? this[i][n] & zero : this[i][n])
                return false;
        }
        return true;
    }
    zeroExceptMask(n, mask) {
        for (let i = 0, len = this.subarrays; i < len; ++i) {
            if (this[i][n] & mask[i])
                return false;
        }
        return true;
    }
    only(n, offset, one) {
        for (let i = 0, len = this.subarrays; i < len; ++i) {
            if (this[i][n] != (i === offset ? one : 0))
                return false;
        }
        return true;
    }
    onlyExcept(n, offset, zero, onlyOffset, onlyOne) {
        for (let i = 0, len = this.subarrays; i < len; ++i) {
            let mask = this[i][n];
            if (i === offset)
                mask = (mask & zero) >>> 0;
            if (mask != (i === onlyOffset ? onlyOne : 0))
                return false;
        }
        return true;
    }
}
var xfilterArray = {
    array8: arrayUntyped,
    array16: arrayUntyped,
    array32: arrayUntyped,
    arrayLengthen: arrayLengthenUntyped,
    arrayWiden: arrayWidenUntyped,
    bitarray: BitArray,
};

function filterExact(bisect, value) {
    return function (values) {
        const n = values.length;
        return [bisect.left(values, value, 0, n), bisect.right(values, value, 0, n)];
    };
}
function filterRange(bisect, range) {
    const min = range[0];
    const max = range[1];
    return function (values) {
        const n = values.length;
        return [bisect.left(values, min, 0, n), bisect.left(values, max, 0, n)];
    };
}
function filterAll(values) {
    return [0, values.length];
}
var xfilterFilter = {
    filterExact,
    filterRange,
    filterAll,
};

function identity(value) {
    return value;
}

function bisectBy(value) {
    function bisectLeft(array, target, lo, hi) {
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (value(array[mid]) < target)
                lo = mid + 1;
            else
                hi = mid;
        }
        return lo;
    }
    function bisectRight(array, target, lo, hi) {
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (target < value(array[mid]))
                hi = mid;
            else
                lo = mid + 1;
        }
        return lo;
    }
    return Object.assign(bisectRight, { right: bisectRight, left: bisectLeft });
}
const bisect = Object.assign(bisectBy(identity), { by: bisectBy });

function jsonArray(value) {
    if (!Array.isArray(value))
        throw new TypeError("expected an array");
    return value;
}
function permute(array, index, deep = false) {
    const copy = deep ? jsonArray(JSON.parse(JSON.stringify(array))) : new Array(index.length);
    for (let i = 0, n = index.length; i < n; ++i)
        copy[i] = array[index[i]];
    return copy;
}

function heapBy(value) {
    function heap(array, lo, hi) {
        const n = hi - lo;
        let i = (n >>> 1) + 1;
        while (--i > 0)
            sift(array, i, n, lo);
        return array;
    }
    function sort(array, lo, hi) {
        let n = hi - lo;
        while (--n > 0) {
            const record = array[lo];
            array[lo] = array[lo + n];
            array[lo + n] = record;
            sift(array, 1, n, lo);
        }
        return array;
    }
    function sift(array, i, n, lo) {
        const record = array[--lo + i];
        const x = value(record);
        let child;
        while ((child = i << 1) <= n) {
            if (child < n && value(array[lo + child]) > value(array[lo + child + 1]))
                child++;
            if (x <= value(array[lo + child]))
                break;
            array[lo + i] = array[lo + child];
            i = child;
        }
        array[lo + i] = record;
    }
    heap.sort = sort;
    return heap;
}
const heap = Object.assign(heapBy(identity), { by: heapBy });

function heapselectBy(value) {
    const heap$1 = heap.by(value);
    return function heapselect(array, lo, hi, k) {
        const queue = new Array((k = Math.min(hi - lo, k)));
        for (let i = 0; i < k; ++i)
            queue[i] = array[lo++];
        heap$1(queue, 0, k);
        if (lo < hi) {
            let min = value(queue[0]);
            do {
                const record = array[lo];
                if (value(record) > min) {
                    queue[0] = record;
                    min = value(heap$1(queue, 0, k)[0]);
                }
            } while (++lo < hi);
        }
        return queue;
    };
}
const heapselect = Object.assign(heapselectBy(identity), { by: heapselectBy });

const REMOVED_INDEX = -1;
function indexArray(n, m) {
    return (m < 0x101 ? xfilterArray.array8 : m < 0x10001 ? xfilterArray.array16 : xfilterArray.array32)(n);
}
function indexRange(n) {
    const range = indexArray(n, n);
    for (let i = -1; ++i < n;)
        range[i] = i;
    return range;
}
function capacity(width) {
    return width === 8 ? 0x100 : width === 16 ? 0x10000 : 0x100000000;
}

function zero() {
    return 0;
}

function createGroupMethods(view) {
    const dispose = () => view.dispose();
    return {
        all: () => view.all(),
        top: (count) => view.top(count),
        order: (value) => view.order(value),
        orderNatural: () => view.orderNatural(),
        dispose,
        remove: dispose,
    };
}
function createOrdering(view, value) {
    const valueOf = (entry) => value(entry.value);
    const select = heapselect.by(valueOf);
    const heap$1 = heap.by(valueOf);
    return {
        select,
        heap: heap$1,
        top(count) {
            const groups = view.all();
            const selected = select(groups, 0, groups.length, count);
            return heap$1.sort(selected, 0, selected.length);
        },
    };
}
function initializeGroups(groups, initial) {
    for (let i = 0; i < groups.length; ++i) {
        const entry = groups[i];
        const value = initial();
        entry.value = value;
        if (!Object.is(entry.value, value))
            return false;
    }
    return true;
}
function createGroup(state, dimension, key) {
    return createGrouping(state, dimension, key);
}
function createGrouping(state, dimension, key, singleton) {
    const group = {};
    const view = {};
    const { iterable, offset, one, zero: zero$1 } = dimension;
    let entries = [];
    let groupIndex = xfilterArray.array8(0);
    let iterableGroupIndex = [];
    let groupWidth = 8;
    let groupCapacity = capacity(groupWidth);
    let k = 0;
    let ordering;
    let update = () => { };
    let add = () => { };
    let remove = () => { };
    state.filterListeners.push(update);
    dimension.indexListeners.push(add);
    state.removeDataListeners.push(remove);
    function configure(reduceAdd, reduceRemove, reduceInitial) {
        let groups = [];
        let resetNeeded = true;
        let retainedOrdering = ordering;
        let groupLookup;
        const groupBisect = bisect.by((entry) => entry.key);
        let select = heapselect.by((entry) => entry.value);
        let heap$1 = heap.by((entry) => entry.value);
        function setUpdate() {
            const next = k > 1 || iterable ? updateMany : k === 1 ? updateOne : updateNone;
            const index = state.filterListeners.indexOf(update);
            if (index >= 0)
                state.filterListeners[index] = next;
            update = next;
        }
        function updateNone() { }
        function addData(newValues, newIndex, n0, n1) {
            const { data, filters, n } = state;
            groupLookup = undefined;
            const recordOffset = n0;
            if (iterable) {
                n0 = dimension.values.length - newValues.length;
                n1 = newValues.length;
            }
            const oldEntries = entries;
            const oldGroups = groups;
            let reIndex = iterable ? xfilterArray.array32(k) : indexArray(k, groupCapacity);
            const k0 = k;
            let i0 = 0;
            let i1 = 0;
            const nextGroups = [];
            entries = resetNeeded ? new Array(k) : nextGroups;
            groups = nextGroups;
            k = 0;
            if (iterable) {
                if (!k0)
                    iterableGroupIndex = [];
            }
            else {
                groupIndex = k0 > 1 ? xfilterArray.arrayLengthen(groupIndex, n) : indexArray(n, groupCapacity);
            }
            let oldEntry = oldEntries[i0];
            if (n1) {
                let nextKey = key(newValues[i1]);
                while (!(nextKey >= nextKey) && ++i1 < n1)
                    nextKey = key(newValues[i1]);
                while (i1 < n1) {
                    let entry;
                    if (oldEntry && oldEntry.key <= nextKey) {
                        entry = oldEntry;
                        if (!resetNeeded)
                            groups[k] = oldGroups[i0];
                        reIndex[i0] = k;
                        oldEntry = oldEntries[++i0];
                    }
                    else if (resetNeeded) {
                        entry = { key: nextKey, value: null };
                    }
                    else {
                        entry = groups[k] = { key: nextKey, value: reduceInitial() };
                    }
                    if (resetNeeded)
                        entries[k] = entry;
                    while (nextKey <= entry.key) {
                        const recordIndex = newIndex[i1] + (iterable ? recordOffset : n0);
                        if (iterable) {
                            const recordGroups = iterableGroupIndex[recordIndex];
                            if (recordGroups)
                                recordGroups.push(k);
                            else
                                iterableGroupIndex[recordIndex] = [k];
                        }
                        else {
                            groupIndex[recordIndex] = k;
                        }
                        if (!resetNeeded) {
                            const current = groups[k];
                            current.value = reduceAdd(current.value, data[recordIndex], true);
                            if (!filters.zeroExcept(recordIndex, offset, zero$1))
                                current.value = reduceRemove(current.value, data[recordIndex], false);
                        }
                        if (++i1 >= n1)
                            break;
                        nextKey = key(newValues[i1]);
                    }
                    increment();
                }
            }
            while (i0 < k0) {
                reIndex[i0] = k;
                if (resetNeeded)
                    entries[k] = oldEntries[i0];
                else
                    groups[k] = oldGroups[i0];
                ++i0;
                increment();
            }
            if (iterable) {
                for (let i = 0; i < n; ++i) {
                    if (!iterableGroupIndex[i])
                        iterableGroupIndex[i] = [];
                }
            }
            if (k > i0) {
                if (iterable) {
                    for (i0 = 0; i0 < recordOffset; ++i0) {
                        const recordGroups = iterableGroupIndex[i0];
                        for (let j = 0; j < recordGroups.length; ++j)
                            recordGroups[j] = reIndex[recordGroups[j]];
                    }
                }
                else {
                    for (i0 = 0; i0 < n0; ++i0)
                        groupIndex[i0] = reIndex[groupIndex[i0]];
                }
            }
            if (k <= 1 && !iterable) {
                if (!k && singleton) {
                    k = 1;
                    if (resetNeeded)
                        entries = [{ key: singleton.key, value: null }];
                    else
                        entries = groups = [{ key: singleton.key, value: reduceInitial() }];
                }
                groupIndex = xfilterArray.array8(0);
            }
            setUpdate();
            function increment() {
                if (iterable) {
                    ++k;
                }
                else if (++k === groupCapacity) {
                    reIndex = xfilterArray.arrayWiden(reIndex, (groupWidth <<= 1));
                    groupIndex = xfilterArray.arrayWiden(groupIndex, groupWidth);
                    groupCapacity = capacity(groupWidth);
                }
            }
        }
        function removeData(reIndex) {
            const { n } = state;
            groupLookup = undefined;
            if (k > 1 || iterable) {
                const oldK = k;
                const oldEntries = entries;
                const oldGroups = groups;
                const seenGroups = indexArray(oldK, oldK);
                let remaining = 0;
                if (iterable) {
                    for (let i = 0; i < n; ++i) {
                        if (reIndex[i] !== REMOVED_INDEX) {
                            const recordGroups = (iterableGroupIndex[remaining++] = iterableGroupIndex[i]);
                            for (let j = 0; j < recordGroups.length; ++j)
                                seenGroups[recordGroups[j]] = 1;
                        }
                    }
                    iterableGroupIndex = iterableGroupIndex.slice(0, remaining);
                }
                else {
                    for (let i = 0; i < n; ++i) {
                        if (reIndex[i] !== REMOVED_INDEX)
                            seenGroups[(groupIndex[remaining++] = groupIndex[i])] = 1;
                    }
                }
                groups = [];
                entries = resetNeeded ? [] : groups;
                k = 0;
                for (let i = 0; i < oldK; ++i) {
                    if (seenGroups[i]) {
                        seenGroups[i] = k++;
                        if (resetNeeded)
                            entries.push(oldEntries[i]);
                        else
                            groups.push(oldGroups[i]);
                    }
                }
                if (k > 1 || iterable) {
                    if (iterable) {
                        for (let i = 0; i < remaining; ++i) {
                            const recordGroups = iterableGroupIndex[i];
                            for (let j = 0; j < recordGroups.length; ++j)
                                recordGroups[j] = seenGroups[recordGroups[j]];
                        }
                    }
                    else {
                        for (let i = 0; i < remaining; ++i)
                            groupIndex[i] = seenGroups[groupIndex[i]];
                    }
                }
                else {
                    groupIndex = xfilterArray.array8(0);
                }
                setUpdate();
            }
            else if (k === 1 && !singleton) {
                for (let i = 0; i < n; ++i)
                    if (reIndex[i] !== REMOVED_INDEX)
                        return;
                entries = [];
                groups = [];
                k = 0;
                setUpdate();
            }
        }
        function updateMany(filterOne, filterOffset, added, removed, notFilter) {
            if ((filterOne === one && filterOffset === offset) || resetNeeded)
                return;
            const { data, filters } = state;
            if (iterable) {
                for (let i = 0; i < added.length; ++i) {
                    const recordIndex = added[i];
                    if (filters.zeroExcept(recordIndex, offset, zero$1)) {
                        const recordGroups = iterableGroupIndex[recordIndex];
                        for (let j = 0; j < recordGroups.length; ++j) {
                            const entry = groups[recordGroups[j]];
                            entry.value = reduceAdd(entry.value, data[recordIndex], false, j);
                        }
                    }
                }
                for (let i = 0; i < removed.length; ++i) {
                    const recordIndex = removed[i];
                    if (filters.onlyExcept(recordIndex, offset, zero$1, filterOffset, filterOne)) {
                        const recordGroups = iterableGroupIndex[recordIndex];
                        for (let j = 0; j < recordGroups.length; ++j) {
                            const entry = groups[recordGroups[j]];
                            entry.value = reduceRemove(entry.value, data[recordIndex], notFilter, j);
                        }
                    }
                }
            }
            else {
                for (let i = 0; i < added.length; ++i) {
                    const recordIndex = added[i];
                    if (filters.zeroExcept(recordIndex, offset, zero$1)) {
                        const entry = groups[groupIndex[recordIndex]];
                        entry.value = reduceAdd(entry.value, data[recordIndex], false);
                    }
                }
                for (let i = 0; i < removed.length; ++i) {
                    const recordIndex = removed[i];
                    if (filters.onlyExcept(recordIndex, offset, zero$1, filterOffset, filterOne)) {
                        const entry = groups[groupIndex[recordIndex]];
                        entry.value = reduceRemove(entry.value, data[recordIndex], notFilter);
                    }
                }
            }
        }
        function updateOne(filterOne, filterOffset, added, removed, notFilter) {
            if ((filterOne === one && filterOffset === offset) || resetNeeded)
                return;
            const { data, filters } = state;
            const entry = groups[0];
            for (let i = 0; i < added.length; ++i) {
                const recordIndex = added[i];
                if (filters.zeroExcept(recordIndex, offset, zero$1))
                    entry.value = reduceAdd(entry.value, data[recordIndex], false);
            }
            for (let i = 0; i < removed.length; ++i) {
                const recordIndex = removed[i];
                if (filters.onlyExcept(recordIndex, offset, zero$1, filterOffset, filterOne))
                    entry.value = reduceRemove(entry.value, data[recordIndex], notFilter);
            }
        }
        function reset() {
            const { data, filters, n } = state;
            if (!initializeGroups(entries, reduceInitial))
                throw new Error("Group value rejected the reducer initial value");
            groups = entries;
            if (k > 1 || iterable) {
                if (iterable) {
                    for (let i = 0; i < n; ++i) {
                        const recordGroups = iterableGroupIndex[i];
                        for (let j = 0; j < recordGroups.length; ++j) {
                            const entry = groups[recordGroups[j]];
                            entry.value = reduceAdd(entry.value, data[i], true, j);
                        }
                    }
                    for (let i = 0; i < n; ++i) {
                        if (!filters.zeroExcept(i, offset, zero$1)) {
                            const recordGroups = iterableGroupIndex[i];
                            for (let j = 0; j < recordGroups.length; ++j) {
                                const entry = groups[recordGroups[j]];
                                entry.value = reduceRemove(entry.value, data[i], false, j);
                            }
                        }
                    }
                }
                else {
                    for (let i = 0; i < n; ++i) {
                        const entry = groups[groupIndex[i]];
                        entry.value = reduceAdd(entry.value, data[i], true);
                    }
                    for (let i = 0; i < n; ++i) {
                        if (!filters.zeroExcept(i, offset, zero$1)) {
                            const entry = groups[groupIndex[i]];
                            entry.value = reduceRemove(entry.value, data[i], false);
                        }
                    }
                }
            }
            else if (k === 1) {
                const entry = groups[0];
                for (let i = 0; i < n; ++i)
                    entry.value = reduceAdd(entry.value, data[i], true);
                for (let i = 0; i < n; ++i) {
                    if (!filters.zeroExcept(i, offset, zero$1))
                        entry.value = reduceRemove(entry.value, data[i], false);
                }
            }
        }
        function readValues() {
            if (resetNeeded) {
                reset();
                resetNeeded = false;
            }
            return groups;
        }
        function readTop(count) {
            readValues();
            if (retainedOrdering) {
                const selected = retainedOrdering.top(count);
                if (selected.length * Math.log2(groups.length) < groups.length) {
                    return selected.map((entry) => groups[groupBisect.left(groups, entry.key, 0, groups.length)]);
                }
                if (!groupLookup) {
                    groupLookup = new Map();
                    for (const entry of groups)
                        groupLookup.set(entry, entry);
                }
                const lookup = groupLookup;
                return selected.map((entry) => {
                    const current = lookup.get(entry);
                    if (!current)
                        throw new Error("Selected group is absent");
                    return current;
                });
            }
            const selected = select(groups, 0, groups.length, count);
            return heap$1.sort(selected, 0, selected.length);
        }
        function setOrder(value) {
            const next = createOrdering(currentView, value);
            select = next.select;
            heap$1 = next.heap;
            ordering = next;
            retainedOrdering = undefined;
            return configured;
        }
        function setNaturalOrder() {
            select = heapselect.by((entry) => entry.value);
            heap$1 = heap.by((entry) => entry.value);
            ordering = retainedOrdering = undefined;
            return configured;
        }
        function dispose() {
            let i = state.filterListeners.indexOf(update);
            if (i >= 0)
                state.filterListeners.splice(i, 1);
            i = dimension.indexListeners.indexOf(add);
            if (i >= 0)
                dimension.indexListeners.splice(i, 1);
            i = state.removeDataListeners.indexOf(remove);
            if (i >= 0)
                state.removeDataListeners.splice(i, 1);
            i = dimension.dimensionGroups.indexOf(configured);
            if (i >= 0)
                dimension.dimensionGroups.splice(i, 1);
            return configured;
        }
        const addIndex = dimension.indexListeners.indexOf(add);
        if (addIndex >= 0)
            dimension.indexListeners[addIndex] = addData;
        add = addData;
        const removeIndex = state.removeDataListeners.indexOf(remove);
        if (removeIndex >= 0)
            state.removeDataListeners[removeIndex] = removeData;
        remove = removeData;
        setUpdate();
        const currentView = Object.assign(view, {
            all: readValues,
            top: readTop,
            order: setOrder,
            orderNatural: setNaturalOrder,
            dispose,
        });
        const configured = Object.assign(group, createGroupMethods(currentView), {
            reduce: configure,
            reduceCount,
            reduceSum,
            size,
        });
        return configured;
    }
    function size() {
        return k;
    }
    function reduceCount() {
        return configure((value) => value + 1, (value) => value - 1, zero);
    }
    function reduceSum(value) {
        return configure((total, record) => total + +value(record), (total, record) => total - value(record), zero);
    }
    const configured = reduceCount();
    dimension.dimensionGroups.push(configured);
    add(dimension.values, dimension.index, 0, state.n);
    return configured;
}
function createDimensionGroupAll(state, dimension) {
    const internal = createGrouping(state, dimension, () => null, { key: null });
    const group = {};
    function expose(configured) {
        function reduce(add, remove, initial) {
            return expose(configured.reduce(add, remove, initial));
        }
        function dispose() {
            configured.dispose();
            const index = dimension.dimensionGroups.indexOf(exposed);
            if (index >= 0)
                dimension.dimensionGroups.splice(index, 1);
            return exposed;
        }
        const exposed = Object.assign(group, {
            reduce,
            reduceCount: () => expose(configured.reduceCount()),
            reduceSum: (value) => expose(configured.reduceSum(value)),
            value: () => configured.all()[0].value,
            dispose,
            remove: dispose,
        });
        return exposed;
    }
    const exposed = expose(internal);
    dimension.dimensionGroups[dimension.dimensionGroups.indexOf(internal)] = exposed;
    return exposed;
}

function createDimension(context, accessor) {
    const { iterable } = accessor;
    var dimension = {
        accessor: accessor.accessor,
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
        groupAll: groupAll,
        dispose: dispose,
        remove: dispose,
        id: function () {
            return id;
        },
    };
    var one, zero, offset, id, values = [], index = [], newValues = [], newIndex = [], iterablesIndexCount = [], iterablesIndexFilterStatus = [], iterablesEmptyRows = [], sortRange = function (n) {
        return indexRange(n).sort(function (A, B) {
            var a = newValues[A], b = newValues[B];
            return a < b ? -1 : a > b ? 1 : A - B;
        });
    }, refilter = xfilterFilter.filterAll, refilterFunction, filterValue, filterValuePresent, indexListeners = [], dimensionGroups = [], lo0 = 0, hi0 = 0, t = 0;
    context.dataListeners.unshift(preAdd);
    context.dataListeners.push(postAdd);
    context.removeDataListeners.push(removeData);
    var tmp = context.filters.add();
    offset = tmp.offset;
    one = tmp.one;
    zero = ~one;
    id = (offset << 7) | (Math.log(one) / Math.log(2));
    const groupState = {
        values,
        index,
        iterable,
        offset,
        one,
        zero,
        indexListeners,
        dimensionGroups,
    };
    preAdd(context.data, 0, context.n);
    postAdd(context.data, 0, context.n);
    function preAdd(newData, n0, n1) {
        var newIterablesIndexCount = [], newIterablesIndexFilterStatus = [];
        var k = [], j = 0;
        if (iterable) {
            t = 0;
            j = 0;
            k = [];
            for (var i0 = 0; i0 < newData.length; i0++) {
                for (j = 0, k = accessor.value(newData[i0]); j < k.length; j++) {
                    t++;
                }
            }
            newValues = [];
            newIterablesIndexCount = indexRange(newData.length);
            newIterablesIndexFilterStatus = indexArray(t, 1);
            var unsortedIndex = indexRange(t);
            for (var l = 0, index1 = 0; index1 < newData.length; index1++) {
                k = accessor.value(newData[index1]);
                if (!k.length) {
                    newIterablesIndexCount[index1] = 0;
                    iterablesEmptyRows.push(index1 + n0);
                    continue;
                }
                newIterablesIndexCount[index1] = k.length;
                for (j = 0; j < k.length; j++) {
                    newValues.push(k[j]);
                    unsortedIndex[l] = index1;
                    l++;
                }
            }
            var sortMap = sortRange(t);
            newValues = permute(newValues, sortMap);
            newIndex = permute(unsortedIndex, sortMap);
        }
        else {
            newValues = newData.map(accessor.value);
            newIndex = sortRange(n1);
            newValues = permute(newValues, newIndex);
        }
        var bounds = refilter(newValues), lo1 = bounds[0], hi1 = bounds[1];
        var index2, index3, index4;
        if (iterable) {
            n1 = t;
            if (refilterFunction) {
                for (index2 = 0; index2 < n1; ++index2) {
                    if (!refilterFunction(newValues[index2], index2)) {
                        if (--newIterablesIndexCount[newIndex[index2]] === 0) {
                            context.filters[offset][newIndex[index2] + n0] |= one;
                        }
                        newIterablesIndexFilterStatus[index2] = 1;
                    }
                }
            }
            else {
                for (index3 = 0; index3 < lo1; ++index3) {
                    if (--newIterablesIndexCount[newIndex[index3]] === 0) {
                        context.filters[offset][newIndex[index3] + n0] |= one;
                    }
                    newIterablesIndexFilterStatus[index3] = 1;
                }
                for (index4 = hi1; index4 < n1; ++index4) {
                    if (--newIterablesIndexCount[newIndex[index4]] === 0) {
                        context.filters[offset][newIndex[index4] + n0] |= one;
                    }
                    newIterablesIndexFilterStatus[index4] = 1;
                }
            }
        }
        else {
            if (refilterFunction) {
                for (index2 = 0; index2 < n1; ++index2) {
                    if (!refilterFunction(newValues[index2], index2)) {
                        context.filters[offset][newIndex[index2] + n0] |= one;
                    }
                }
            }
            else {
                for (index3 = 0; index3 < lo1; ++index3) {
                    context.filters[offset][newIndex[index3] + n0] |= one;
                }
                for (index4 = hi1; index4 < n1; ++index4) {
                    context.filters[offset][newIndex[index4] + n0] |= one;
                }
            }
        }
        if (!n0) {
            values = newValues;
            index = newIndex;
            iterablesIndexCount = newIterablesIndexCount;
            iterablesIndexFilterStatus = newIterablesIndexFilterStatus;
            lo0 = lo1;
            hi0 = hi1;
            return;
        }
        var oldValues = values, oldIndex = index, oldIterablesIndexFilterStatus = iterablesIndexFilterStatus, old_n0 = n0, i1 = 0;
        i0 = 0;
        if (iterable) {
            old_n0 = n0;
            n0 = oldValues.length;
            n1 = t;
        }
        values = iterable ? new Array(n0 + n1) : new Array(context.n);
        index = iterable ? new Array(n0 + n1) : indexArray(context.n, context.n);
        if (iterable)
            iterablesIndexFilterStatus = indexArray(n0 + n1, 1);
        if (iterable) {
            var oldiiclength = iterablesIndexCount.length;
            iterablesIndexCount = xfilterArray.arrayLengthen(iterablesIndexCount, context.n);
            for (var j = 0; j + oldiiclength < context.n; j++) {
                iterablesIndexCount[j + oldiiclength] = newIterablesIndexCount[j];
            }
        }
        var index5 = 0;
        for (; i0 < n0 && i1 < n1; ++index5) {
            if (oldValues[i0] < newValues[i1]) {
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
        bounds = refilter(values);
        lo0 = bounds[0];
        hi0 = bounds[1];
    }
    function postAdd(newData, n0, n1) {
        groupState.values = values;
        groupState.index = index;
        indexListeners.forEach(function (l) {
            l(newValues, newIndex, n0, n1);
        });
        newValues = [];
        newIndex = [];
    }
    function removeData(reIndex) {
        if (iterable) {
            for (var i0 = 0, i1 = 0; i0 < iterablesEmptyRows.length; i0++) {
                if (reIndex[iterablesEmptyRows[i0]] !== REMOVED_INDEX) {
                    iterablesEmptyRows[i1] = reIndex[iterablesEmptyRows[i0]];
                    i1++;
                }
            }
            iterablesEmptyRows.length = i1;
            for (i0 = 0, i1 = 0; i0 < context.n; i0++) {
                if (reIndex[i0] !== REMOVED_INDEX) {
                    if (i1 !== i0)
                        iterablesIndexCount[i1] = iterablesIndexCount[i0];
                    i1++;
                }
            }
            iterablesIndexCount = iterablesIndexCount.slice(0, i1);
        }
        var n0 = values.length;
        for (var i = 0, j = 0, oldDataIndex; i < n0; ++i) {
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
        var bounds = refilter(values);
        lo0 = bounds[0];
        hi0 = bounds[1];
    }
    function filterIndexBounds(bounds) {
        var lo1 = bounds[0], hi1 = bounds[1];
        if (refilterFunction) {
            refilterFunction = undefined;
            filterIndexFunction(function (d, i) {
                return lo1 <= i && i < hi1;
            }, bounds[0] === 0 && bounds[1] === values.length);
            lo0 = lo1;
            hi0 = hi1;
            return dimension;
        }
        var i, j, k, added = [], removed = [], valueIndexAdded = [], valueIndexRemoved = [];
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
        if (!iterable) {
            for (i = 0; i < added.length; i++) {
                context.filters[offset][added[i]] ^= one;
            }
            for (i = 0; i < removed.length; i++) {
                context.filters[offset][removed[i]] ^= one;
            }
        }
        else {
            var newAdded = [];
            var newRemoved = [];
            for (i = 0; i < added.length; i++) {
                iterablesIndexCount[added[i]]++;
                iterablesIndexFilterStatus[valueIndexAdded[i]] = 0;
                if (iterablesIndexCount[added[i]] === 1) {
                    context.filters[offset][added[i]] ^= one;
                    newAdded.push(added[i]);
                }
            }
            for (i = 0; i < removed.length; i++) {
                iterablesIndexCount[removed[i]]--;
                iterablesIndexFilterStatus[valueIndexRemoved[i]] = 1;
                if (iterablesIndexCount[removed[i]] === 0) {
                    context.filters[offset][removed[i]] ^= one;
                    newRemoved.push(removed[i]);
                }
            }
            added = newAdded;
            removed = newRemoved;
            if (refilter === xfilterFilter.filterAll) {
                for (i = 0; i < iterablesEmptyRows.length; i++) {
                    if (context.filters[offset][(k = iterablesEmptyRows[i])] & one) {
                        context.filters[offset][k] ^= one;
                        added.push(k);
                    }
                }
            }
            else {
                for (i = 0; i < iterablesEmptyRows.length; i++) {
                    if (!(context.filters[offset][(k = iterablesEmptyRows[i])] & one)) {
                        context.filters[offset][k] ^= one;
                        removed.push(k);
                    }
                }
            }
        }
        lo0 = lo1;
        hi0 = hi1;
        context.filterListeners.forEach(function (l) {
            l(one, offset, added, removed);
        });
        context.triggerOnChange("filtered");
        return dimension;
    }
    function filter(range) {
        if (range == null)
            return filterAll();
        if (isFilterRange(range))
            return filterRange(range);
        if (isFilterPredicate(range))
            return filterFunction(range);
        return filterExact(range);
    }
    function filterExact(value) {
        filterValue = value;
        filterValuePresent = true;
        return filterIndexBounds((refilter = xfilterFilter.filterExact(bisect, value))(values));
    }
    function filterRange(range) {
        filterValue = range;
        filterValuePresent = true;
        return filterIndexBounds((refilter = xfilterFilter.filterRange(bisect, range))(values));
    }
    function filterAll() {
        filterValue = undefined;
        filterValuePresent = false;
        return filterIndexBounds((refilter = xfilterFilter.filterAll)(values));
    }
    function filterFunction(f) {
        filterValue = f;
        filterValuePresent = true;
        refilterFunction = f;
        refilter = xfilterFilter.filterAll;
        filterIndexFunction(f, false);
        var bounds = refilter(values);
        lo0 = bounds[0];
        hi0 = bounds[1];
        return dimension;
    }
    function filterIndexFunction(f, filterAll) {
        var i, k, x, added = [], removed = [], valueIndexAdded = [], valueIndexRemoved = [], indexLength = values.length;
        if (!iterable) {
            for (i = 0; i < indexLength; ++i) {
                if (!(context.filters[offset][(k = index[i])] & one) !== !!(x = f(values[i], i))) {
                    if (x)
                        added.push(k);
                    else
                        removed.push(k);
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
                if (context.filters[offset][added[i]] & one)
                    context.filters[offset][added[i]] &= zero;
            }
            for (i = 0; i < removed.length; i++) {
                if (!(context.filters[offset][removed[i]] & one))
                    context.filters[offset][removed[i]] |= one;
            }
        }
        else {
            var newAdded = [];
            var newRemoved = [];
            for (i = 0; i < added.length; i++) {
                if (iterablesIndexFilterStatus[valueIndexAdded[i]] === 1) {
                    iterablesIndexCount[added[i]]++;
                    iterablesIndexFilterStatus[valueIndexAdded[i]] = 0;
                    if (iterablesIndexCount[added[i]] === 1) {
                        context.filters[offset][added[i]] ^= one;
                        newAdded.push(added[i]);
                    }
                }
            }
            for (i = 0; i < removed.length; i++) {
                if (iterablesIndexFilterStatus[valueIndexRemoved[i]] === 0) {
                    iterablesIndexCount[removed[i]]--;
                    iterablesIndexFilterStatus[valueIndexRemoved[i]] = 1;
                    if (iterablesIndexCount[removed[i]] === 0) {
                        context.filters[offset][removed[i]] ^= one;
                        newRemoved.push(removed[i]);
                    }
                }
            }
            added = newAdded;
            removed = newRemoved;
            if (filterAll) {
                for (i = 0; i < iterablesEmptyRows.length; i++) {
                    if (context.filters[offset][(k = iterablesEmptyRows[i])] & one) {
                        context.filters[offset][k] ^= one;
                        added.push(k);
                    }
                }
            }
            else {
                for (i = 0; i < iterablesEmptyRows.length; i++) {
                    if (!(context.filters[offset][(k = iterablesEmptyRows[i])] & one)) {
                        context.filters[offset][k] ^= one;
                        removed.push(k);
                    }
                }
            }
        }
        context.filterListeners.forEach(function (l) {
            l(one, offset, added, removed);
        });
        context.triggerOnChange("filtered");
    }
    function currentFilter() {
        return filterValue;
    }
    function hasCurrentFilter() {
        return filterValuePresent;
    }
    function top(k, top_offset) {
        var array = [], i = hi0, j, toSkip = 0;
        if (top_offset && top_offset > 0)
            toSkip = top_offset;
        while (--i >= lo0 && k > 0) {
            if (context.filters.zero((j = index[i]))) {
                if (toSkip > 0) {
                    --toSkip;
                }
                else {
                    array.push(context.data[j]);
                    --k;
                }
            }
        }
        if (iterable) {
            for (i = 0; i < iterablesEmptyRows.length && k > 0; i++) {
                if (context.filters.zero((j = iterablesEmptyRows[i]))) {
                    if (toSkip > 0) {
                        --toSkip;
                    }
                    else {
                        array.push(context.data[j]);
                        --k;
                    }
                }
            }
        }
        return array;
    }
    function bottom(k, bottom_offset) {
        var array = [], i, j, toSkip = 0;
        if (bottom_offset && bottom_offset > 0)
            toSkip = bottom_offset;
        if (iterable) {
            for (i = 0; i < iterablesEmptyRows.length && k > 0; i++) {
                if (context.filters.zero((j = iterablesEmptyRows[i]))) {
                    if (toSkip > 0) {
                        --toSkip;
                    }
                    else {
                        array.push(context.data[j]);
                        --k;
                    }
                }
            }
        }
        i = lo0;
        while (i < hi0 && k > 0) {
            if (context.filters.zero((j = index[i]))) {
                if (toSkip > 0) {
                    --toSkip;
                }
                else {
                    array.push(context.data[j]);
                    --k;
                }
            }
            i++;
        }
        return array;
    }
    function group(key) {
        return key
            ? createGroup(context, groupState, key)
            : createGroup(context, groupState, identity);
    }
    function groupAll() {
        return createDimensionGroupAll(context, groupState);
    }
    function dispose() {
        dimensionGroups.forEach(function (group) {
            group.dispose();
        });
        var i = context.dataListeners.indexOf(preAdd);
        if (i >= 0)
            context.dataListeners.splice(i, 1);
        i = context.dataListeners.indexOf(postAdd);
        if (i >= 0)
            context.dataListeners.splice(i, 1);
        i = context.removeDataListeners.indexOf(removeData);
        if (i >= 0)
            context.removeDataListeners.splice(i, 1);
        context.filters.masks[offset] &= zero;
        return filterAll();
    }
    return dimension;
}
function isFilterRange(value) {
    return Array.isArray(value);
}
function isFilterPredicate(value) {
    return typeof value === "function";
}

function createGroupAllMethods(view) {
    const dispose = () => view.dispose();
    return {
        value: () => view.value(),
        dispose,
        remove: dispose,
    };
}
function createGroupAll(state) {
    const group = {};
    const view = {};
    let update = () => { };
    let add = () => { };
    state.filterListeners.push(update);
    state.dataListeners.push(add);
    function configure(reduceAdd, reduceRemove, reduceInitial) {
        let reduceValue;
        let resetNeeded = true;
        function addData(_newData, n0) {
            if (resetNeeded)
                return;
            const { data, filters, n } = state;
            for (let i = n0; i < n; ++i) {
                reduceValue = reduceAdd(reduceValue, data[i], true);
                if (!filters.zero(i))
                    reduceValue = reduceRemove(reduceValue, data[i], false);
            }
        }
        function updateFilters(filterOne, filterOffset, added, removed, notFilter) {
            if (resetNeeded)
                return;
            const { data, filters } = state;
            for (let i = 0; i < added.length; ++i) {
                const index = added[i];
                if (filters.zero(index))
                    reduceValue = reduceAdd(reduceValue, data[index], notFilter);
            }
            for (let i = 0; i < removed.length; ++i) {
                const index = removed[i];
                if (filters.only(index, filterOffset, filterOne))
                    reduceValue = reduceRemove(reduceValue, data[index], notFilter);
            }
        }
        function readValue() {
            if (resetNeeded) {
                const { data, filters, n } = state;
                reduceValue = reduceInitial();
                for (let i = 0; i < n; ++i) {
                    reduceValue = reduceAdd(reduceValue, data[i], true);
                    if (!filters.zero(i))
                        reduceValue = reduceRemove(reduceValue, data[i], false);
                }
                resetNeeded = false;
            }
            return reduceValue;
        }
        function dispose() {
            let i = state.filterListeners.indexOf(update);
            if (i >= 0)
                state.filterListeners.splice(i, 1);
            i = state.dataListeners.indexOf(add);
            if (i >= 0)
                state.dataListeners.splice(i, 1);
            return configured;
        }
        const filterIndex = state.filterListeners.indexOf(update);
        if (filterIndex >= 0)
            state.filterListeners[filterIndex] = updateFilters;
        update = updateFilters;
        const dataIndex = state.dataListeners.indexOf(add);
        if (dataIndex >= 0)
            state.dataListeners[dataIndex] = addData;
        add = addData;
        const currentView = Object.assign(view, { value: readValue, dispose });
        const configured = Object.assign(group, createGroupAllMethods(currentView), {
            reduce: configure,
            reduceCount,
            reduceSum,
        });
        return configured;
    }
    function reduceCount() {
        return configure((value) => value + 1, (value) => value - 1, zero);
    }
    function reduceSum(value) {
        return configure((total, record) => total + +value(record), (total, record) => total - value(record), zero);
    }
    return reduceCount();
}

function property(object, key) {
    if (object === null || object === undefined)
        throw new TypeError("Cannot read properties of null or undefined");
    const value = Reflect.get(Object(object), key);
    return value;
}
function result(object, path) {
    const parts = path.replace(/\[([\w\d]+)\]/g, ".$1").split(".");
    let parent = object;
    for (let i = 0; i < parts.length - 1; i++) {
        const next = property(parent, parts[i]) || {};
        if (!isObject(parent) || !Reflect.set(parent, parts[i], next)) {
            throw new TypeError("Cannot assign a property on the path");
        }
        parent = next;
    }
    const value = property(parent, parts[parts.length - 1]);
    if (typeof value === "function") {
        const resolved = Reflect.apply(value, parent, []);
        return resolved;
    }
    return value;
}
function isObject(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
}

var version = "1.5.4";

function crossfilter(records) {
    const callbacks = [];
    const state = {
        data: [],
        n: 0,
        filters: new xfilterArray.bitarray(0),
        filterListeners: [],
        dataListeners: [],
        removeDataListeners: [],
        triggerOnChange,
    };
    const crossfilter = {
        add,
        remove: removeData,
        dimension,
        groupAll,
        size,
        all,
        allFiltered,
        onChange,
        isElementFiltered,
    };
    function add(newData) {
        const n0 = state.n;
        const n1 = newData.length;
        if (n1) {
            state.data = state.data.concat(newData);
            state.filters.lengthen((state.n += n1));
            state.dataListeners.forEach((listener) => listener(newData, n0, n1));
            triggerOnChange("dataAdded");
        }
        return crossfilter;
    }
    function removeData(predicate) {
        const newIndex = new Array(state.n);
        const removed = [];
        for (let index1 = 0, index2 = 0; index1 < state.n; ++index1) {
            if (predicate ? predicate(state.data[index1], index1) : state.filters.zero(index1)) {
                removed.push(index1);
                newIndex[index1] = REMOVED_INDEX;
            }
            else {
                newIndex[index1] = index2++;
            }
        }
        state.filterListeners.forEach((listener) => listener(-1, -1, [], removed, true));
        state.removeDataListeners.forEach((listener) => listener(newIndex));
        let index4 = 0;
        for (let index3 = 0; index3 < state.n; ++index3) {
            if (newIndex[index3] !== REMOVED_INDEX) {
                if (index3 !== index4) {
                    state.filters.copy(index4, index3);
                    state.data[index4] = state.data[index3];
                }
                ++index4;
            }
        }
        state.data.length = state.n = index4;
        state.filters.truncate(index4);
        triggerOnChange("dataRemoved");
    }
    function maskForDimensions(dimensions) {
        const mask = new Array(state.filters.subarrays);
        for (let n = 0; n < state.filters.subarrays; n++)
            mask[n] = ~0;
        for (let d = 0; d < dimensions.length; d++) {
            const id = dimensions[d].id();
            mask[id >> 7] &= ~(0x1 << (id & 0x3f));
        }
        return mask;
    }
    function isElementFiltered(index, ignoreDimensions = []) {
        return state.filters.zeroExceptMask(index, maskForDimensions(ignoreDimensions));
    }
    function dimension(value, iterable = false) {
        const accessor = typeof value === "string" ? (record) => result(record, value) : value;
        if (iterable) {
            const readValues = (record) => {
                const values = accessor(record);
                if (!isIterableValue(values))
                    throw new TypeError("Iterable dimension accessor must return an array-like value");
                return values;
            };
            return createDimension(state, { value: readValues, accessor, iterable: true });
        }
        return createDimension(state, { value: accessor, accessor, iterable: false });
    }
    function groupAll() {
        return createGroupAll(state);
    }
    function size() {
        return state.n;
    }
    function all() {
        return state.data;
    }
    function allFiltered(ignoreDimensions = []) {
        const array = [];
        const mask = maskForDimensions(ignoreDimensions);
        for (let i = 0; i < state.n; i++) {
            if (state.filters.zeroExceptMask(i, mask))
                array.push(state.data[i]);
        }
        return array;
    }
    function onChange(callback) {
        if (typeof callback !== "function") {
            console.warn("onChange callback parameter must be a function!");
            return undefined;
        }
        callbacks.push(callback);
        return function () {
            callbacks.splice(callbacks.indexOf(callback), 1);
        };
    }
    function triggerOnChange(event) {
        for (let i = 0; i < callbacks.length; i++)
            callbacks[i](event);
    }
    return records ? add(records) : crossfilter;
}
function isIterableValue(value) {
    return (typeof value === "string" ||
        (typeof value === "object" &&
            value !== null &&
            "length" in value &&
            typeof value.length === "number"));
}
var crossfilter$1 = crossfilter;
(function (crossfilter) {
    crossfilter.version = version;
    crossfilter.heap = heap;
    crossfilter.heapselect = heapselect;
    crossfilter.bisect = bisect;
    crossfilter.permute = permute;
})(crossfilter || (crossfilter = {}));

export { crossfilter$1 as default };
