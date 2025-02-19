import React from "react";
import { Box } from "@mui/material";

const Layout = ({ navbarContent, sidebarContent, mainContent }) => {
  return (
    // Capturing the entire webpage in a box
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#121212", // Dark background color
        color: "#fff", // Text color
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Navbar Section */}
      <Box
        sx={{
          width: "100%",
          height: "60px", // Height of the navbar
          borderBottom: "2px solid #000", // Line below the navbar
          padding: "10px",
          display: "flex",
          position: "fixed", // Fix the navbar
          top: 0,
          zIndex: 1000,
          backgroundColor: "#121212", // Ensure consistent background
        }}
      >
        {navbarContent}
      </Box>

      {/* Main Content Wrapper */}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: { xs: "column", sm: "row" }, // Sidebar moves to the top for XS
          marginTop: "60px", // Push below the fixed navbar
          height: "calc(100% - 60px)",
        }}
      >
        {/* Sidebar Section */}
        <Box
          sx={{
            width: { xs: "100%", sm: "200px", md: "250px", lg: "300px" }, // Responsive Width of the sidebar
            height: { xs: "60px", sm: "100%" }, // Sidebar height for XS
            transition: "all 0.3s ease-in-out", // Transition for responsiveness
            borderBottom: { xs: "1px solid #3d3d3d", sm: "none" }, // Border for XS
            borderRight: { xs: "none", sm: "1px solid #3d3d3d" }, // Border for other screens
            padding: { xs: "10px", sm: "20px" },
            position: { xs: "relative", sm: "fixed" }, // Sidebar is not fixed for XS
            top: { xs: "0", sm: "60px" }, // Position below the navbar for SM and above
            zIndex: 900,
            backgroundColor: "#121212", // Ensure consistent background
            overflowX: { xs: "auto", sm: "hidden" }, // Horizontal scrolling for XS
            display: { xs: "flex", sm: "block" },
            flexDirection: { xs: "row", sm: "column" }, // Horizontal buttons for XS
            alignItems: { xs: "center", sm: "flex-start" }, // Center buttons for XS
          }}
        >
          {sidebarContent}
        </Box>

        {/* Main Content Section */}
        <Box
          sx={{
            flex: 1,
            marginLeft: { xs: "0", sm: "200px", md: "250px", lg: "300px" }, // Push beside the fixed sidebar for SM and above
            marginTop: { xs: "0", sm: "0" }, // Push below the sidebar for XS
            padding: "20px",
            overflowY: "auto", // Enable scrolling for the main content
            height: { xs: "calc(100vh - 120px)", sm: "calc(100vh - 60px)" }, // Adjust height for XS
            // Styles for the scrollbar
            "&::-webkit-scrollbar": { width: {xs: "0px", sm:"7px"} },  // no scrollbar in xs screen size
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "#FF6961",
              borderRadius: "10px",
            },
            "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "#636363" },
            "&::-webkit-scrollbar-track": { backgroundColor: "#fff", borderRadius: "10px" },
          }}
        >
          {mainContent}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;