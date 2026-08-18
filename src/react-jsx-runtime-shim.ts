import React from 'react';

type ElementType = Parameters<typeof React.createElement>[0];
type Props = Record<string, unknown> | null | undefined;

function createElement(type: ElementType, props: Props, key?: string | number | null) {
  const nextProps = props ? { ...props } : {};
  if (key !== undefined && key !== null) nextProps.key = key;
  return React.createElement(type, nextProps);
}

export const jsx = createElement;
export const jsxs = createElement;
export const jsxDEV = createElement;
export const Fragment = React.Fragment;
