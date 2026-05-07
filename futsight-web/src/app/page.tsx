import Features from "./Features/features";
import Hero from "./Hero/hero";

export default function FutSightApp() {
  return (
    <div className="min-h-screen bg-black">
      <Hero />
      <Features />
    </div>
  );
}