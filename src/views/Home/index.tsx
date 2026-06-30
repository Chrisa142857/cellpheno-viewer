import React from "react";
import Header from "./Header";
import ResultDisplay from "./ResultDisplay";
import Main from "./Main";

const Home: React.FC = () => {
  return (
    <>
      <Header />
      <ResultDisplay />
      <Main />
    </>
  );
};

export default Home;
