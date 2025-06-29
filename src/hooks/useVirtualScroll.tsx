import { useState, useEffect, useCallback, useMemo } from 'react';

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
  end: number;
}

interface UseVirtualScrollOptions {
  size: number;
  estimateSize: (index: number) => number;
  overscan?: number;
  scrollingDelay?: number;
  getScrollElement?: () => Element | null;
}

interface UseVirtualScrollReturn {
  items: VirtualItem[];
  totalSize: number;
  isScrolling: boolean;
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
  measureElement: (index: number, element: Element) => void;
}

export function useVirtualScroll({
  size,
  estimateSize,
  overscan = 3,
  scrollingDelay = 150,
  getScrollElement,
}: UseVirtualScrollOptions): UseVirtualScrollReturn {
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [measuredSizes, setMeasuredSizes] = useState<Map<number, number>>(new Map());

  // 실제 크기 측정
  const measureElement = useCallback((index: number, element: Element) => {
    const height = element.getBoundingClientRect().height;
    setMeasuredSizes(prev => {
      if (prev.get(index) !== height) {
        const newMap = new Map(prev);
        newMap.set(index, height);
        return newMap;
      }
      return prev;
    });
  }, []);

  // 각 아이템의 위치와 크기 계산
  const items = useMemo(() => {
    const items: VirtualItem[] = [];
    let start = 0;

    for (let index = 0; index < size; index++) {
      const measuredSize = measuredSizes.get(index);
      const itemSize = measuredSize ?? estimateSize(index);
      
      items.push({
        index,
        start,
        size: itemSize,
        end: start + itemSize,
      });
      
      start += itemSize;
    }

    return items;
  }, [size, estimateSize, measuredSizes]);

  // 전체 높이 계산
  const totalSize = items[items.length - 1]?.end ?? 0;

  // 현재 보이는 영역의 아이템들 계산
  const visibleItems = useMemo(() => {
    const containerHeight = scrollHeight;
    const scrollStart = scrollTop;
    const scrollEnd = scrollStart + containerHeight;

    let startIndex = 0;
    let endIndex = 0;

    // 시작 인덱스 찾기
    for (let i = 0; i < items.length; i++) {
      if (items[i].end > scrollStart) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
    }

    // 끝 인덱스 찾기
    for (let i = startIndex; i < items.length; i++) {
      if (items[i].start > scrollEnd) {
        endIndex = Math.min(items.length - 1, i + overscan);
        break;
      }
      endIndex = Math.min(items.length - 1, i + overscan);
    }

    return items.slice(startIndex, endIndex + 1);
  }, [items, scrollTop, scrollHeight, overscan]);

  // 스크롤 이벤트 처리
  useEffect(() => {
    const element = getScrollElement?.();
    if (!element) return;

    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      const { scrollTop, clientHeight } = element;
      setScrollTop(scrollTop);
      setScrollHeight(clientHeight);
      
      if (!isScrolling) {
        setIsScrolling(true);
      }

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsScrolling(false);
      }, scrollingDelay);
    };

    // 초기 값 설정
    handleScroll();
    
    element.addEventListener('scroll', handleScroll, { passive: true });
    
    const resizeObserver = new ResizeObserver(() => {
      handleScroll();
    });
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
    };
  }, [getScrollElement, isScrolling, scrollingDelay]);

  // 특정 인덱스로 스크롤
  const scrollToIndex = useCallback((
    index: number,
    align: 'start' | 'center' | 'end' = 'start'
  ) => {
    const element = getScrollElement?.();
    if (!element || !items[index]) return;

    const item = items[index];
    const containerHeight = element.clientHeight;
    let scrollTop = item.start;

    if (align === 'center') {
      scrollTop = item.start - (containerHeight - item.size) / 2;
    } else if (align === 'end') {
      scrollTop = item.end - containerHeight;
    }

    element.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth'
    });
  }, [items, getScrollElement]);

  return {
    items: visibleItems,
    totalSize,
    isScrolling,
    scrollToIndex,
    measureElement,
  };
}