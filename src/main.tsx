import {createRoot} from 'react-dom/client'
import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'

import "antd/dist/reset.css"

import "./assets/styles/reset.css"
import "./assets/styles/fonts.css"
import router from "@/router";
import './tailwind.css'

createRoot(document.getElementById('root')!).render(
    <Suspense>
        <RouterProvider router={router} />
    </Suspense>
)
