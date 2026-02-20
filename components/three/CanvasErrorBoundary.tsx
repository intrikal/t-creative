/**
 * CanvasErrorBoundary — Catches WebGL crashes and renders HeroFallback.
 *
 * Wraps the R3F Canvas to gracefully handle GPU context loss,
 * shader compilation failures, and other Three.js runtime errors.
 */
"use client";

import { Component } from "react";
import type { ReactNode } from "react";
import { HeroFallback } from "./HeroFallback";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <HeroFallback />;
    }
    return this.props.children;
  }
}
