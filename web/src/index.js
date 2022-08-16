import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import './index.css';

import Home from './Home';
import House from './House';
import Senate from './Senate';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={ <Home />} />
        <Route path="/house" element={ <House />} />
        <Route path="/senate" element={ <Senate />} />
      </Routes>
      <nav>
        <ul>
          <li><NavLink to="/">Home</NavLink></li>
          <li><NavLink to="/house">House of Representatives</NavLink></li>
          <li><NavLink to="/senate">Senate</NavLink></li>
        </ul>
      </nav>
    </HashRouter>
  </React.StrictMode>
);