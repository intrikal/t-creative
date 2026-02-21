"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const DATA = [
  { day: "Mon", amount: 890 },
  { day: "Tue", amount: 1120 },
  { day: "Wed", amount: 760 },
  { day: "Thu", amount: 1340 },
  { day: "Fri", amount: 1480 },
  { day: "Sat", amount: 2100 },
  { day: "Today", amount: 1240 },
] as const;

type Datum = (typeof DATA)[number];

interface Tooltip {
  x: number;
  y: number;
  value: string;
  day: string;
}

export function RevenueChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  useEffect(() => {
    const draw = () => {
      const container = containerRef.current;
      const svg = svgRef.current;
      if (!container || !svg) return;

      const W = container.offsetWidth;
      const H = 200;
      const m = { top: 10, right: 10, bottom: 28, left: 48 };
      const iW = W - m.left - m.right;
      const iH = H - m.top - m.bottom;

      const s = d3.select(svg);
      s.selectAll("*").remove();
      s.attr("width", W).attr("height", H);

      const g = s.append("g").attr("transform", `translate(${m.left},${m.top})`);

      const xScale = d3
        .scaleBand()
        .domain(DATA.map((d) => d.day))
        .range([0, iW])
        .padding(0.38);

      const maxVal = d3.max(DATA, (d) => d.amount) ?? 0;
      const yScale = d3
        .scaleLinear()
        .domain([0, maxVal * 1.15])
        .range([iH, 0]);

      // Subtle horizontal grid lines
      g.append("g")
        .call(
          d3
            .axisLeft(yScale)
            .tickSize(-iW)
            .tickFormat(() => "")
            .ticks(4),
        )
        .call((ax) => {
          ax.select(".domain").remove();
          ax.selectAll(".tick line")
            .attr("stroke", "oklch(0.922 0 0)")
            .attr("stroke-dasharray", "3 3");
        });

      // X axis — day labels
      g.append("g")
        .attr("transform", `translate(0,${iH})`)
        .call(d3.axisBottom(xScale).tickSize(0))
        .call((ax) => {
          ax.select(".domain").remove();
          ax.selectAll<SVGTextElement, string>("text")
            .attr("fill", "#6b5d52")
            .attr("font-size", "11px")
            .attr("dy", "1.2em")
            .style("font-family", "var(--font-geist-sans, sans-serif)");
        });

      // Y axis — dollar labels
      g.append("g")
        .call(
          d3
            .axisLeft(yScale)
            .ticks(4)
            .tickFormat((v) => `$${(+v / 1000).toFixed(1)}k`),
        )
        .call((ax) => {
          ax.select(".domain").remove();
          ax.selectAll(".tick line").remove();
          ax.selectAll<SVGTextElement, d3.NumberValue>("text")
            .attr("fill", "#6b5d52")
            .attr("font-size", "11px")
            .style("font-family", "var(--font-geist-sans, sans-serif)");
        });

      // Bars
      g.selectAll<SVGRectElement, Datum>(".bar")
        .data([...DATA])
        .join("rect")
        .attr("class", "bar")
        .attr("x", (d) => xScale(d.day) ?? 0)
        .attr("width", xScale.bandwidth())
        .attr("y", (d) => yScale(d.amount))
        .attr("height", (d) => iH - yScale(d.amount))
        .attr("rx", 5)
        .attr("fill", (d) => (d.day === "Today" ? "#c4907a" : "#e8c4b8"))
        .style("cursor", "pointer")
        .on("mouseover", function (event: MouseEvent, d) {
          d3.select(this).attr("fill", "#c4907a");
          const rect = container.getBoundingClientRect();
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top - 44,
            value: `$${d.amount.toLocaleString()}`,
            day: d.day,
          });
        })
        .on("mouseout", function (_event, d) {
          d3.select(this).attr("fill", d.day === "Today" ? "#c4907a" : "#e8c4b8");
          setTooltip(null);
        });
    };

    draw();

    const observer = new ResizeObserver(draw);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg ref={svgRef} className="w-full overflow-visible" />
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-md bg-foreground text-background text-xs px-2.5 py-1.5 shadow-lg -translate-x-1/2"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <span className="font-medium">{tooltip.day}</span>
          <span className="ml-2">{tooltip.value}</span>
        </div>
      )}
    </div>
  );
}
