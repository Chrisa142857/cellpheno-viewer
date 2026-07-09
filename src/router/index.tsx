import {lazy} from "react";
import {createHashRouter} from "react-router-dom";
const Home = lazy(() => import("@/views/Home"));
const Preview = lazy(() => import("@/views/Preview"));

export interface RouteConfig {
    path: string;
    element: React.ReactNode;
    children?: RouteConfig[];
    redirect?: string;
}

const routes: RouteConfig[] = [
    {
        path: "/",
        element: <Home/>,
    },
    {
        path: "/preview",
        element: <Preview/>,
    },
    {
        path: "*",
        element: <Home/>,
    },
];

// Hash routing (`/#/preview`) so deep links + refresh work on a static host like
// GitHub Pages, which has no server-side SPA fallback.
export default createHashRouter(routes);
