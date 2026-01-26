"use client";
import React from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";

const Demo = () => {
  return (
    <section id="demo" className="relative overflow-hidden -mt-[12rem] md:-mt-[16rem]">
      <ContainerScroll
        titleComponent={null}
      >
        {/* Empty frame - add video later */}
        <div className="relative w-full h-full bg-gradient-to-br from-card via-background to-card rounded-xl">
          {/* 
            Video element - uncomment and add src when video is ready
            Place your video file at: public/assets/videos/demo.mp4
          */}
          {/* 
          <video
            src="/assets/videos/demo.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover object-left-top rounded-xl"
          />
          */}
        </div>
      </ContainerScroll>
    </section>
  );
};

export default Demo;
