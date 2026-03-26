const express = require("express");
const router = express.Router();
const HomeService = require('../../services/HomeService');
const { authenticate, authorizeRoles } = require("../auth/auth.middleware");

const homeService = new HomeService();

// Public Landing Page
router.get("/", (req, res) => {
    res.render("client/index");
});

const isAdminOrStaff = [authenticate, authorizeRoles("admin", "staff")];
const isParent = [authenticate, authorizeRoles("parent", "admin", "staff")];

router.get("/client/dashboard", isParent, async (req, res) => {
    try {
        const userId = req.user.role === 'admin' || req.user.role === 'staff' ? (req.query.parentId || req.user.id) : req.user.id;
        const { children, upcomingAppointments } = await homeService.getDashboardData(userId);
        res.render("client/dashboard", { 
            children, 
            upcomingAppointments,
            error: null 
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render("client/dashboard", { 
            children: [], 
            upcomingAppointments: [],
            error: "Không thể tải bảng điều khiển." 
        });
    }
});

router.get("/children/add", isAdminOrStaff, async (req, res) => {
    try {
        const parents = await homeService.getParents();
        res.render("client/add-child", { 
            parents, 
            selectedParentId: req.query.parentId 
        });
    } catch (error) {
        res.redirect("/client/dashboard");
    }
});

router.post("/children/add", isAdminOrStaff, async (req, res) => {
    try {
        await homeService.addChild(req.body); 
        res.redirect("/client/dashboard");
    } catch (error) {
        res.render("client/add-child", { error: error.message });
    }
});

router.get("/appointments/book", isParent, async (req, res) => {
    try {
        const { childId } = req.query;
        const children = await homeService.getChildrenForBooking(req.user.id, req.user.role);
        const vaccines = await homeService.getVaccinesForBooking();
        
        let recommendations = [];
        if (childId) {
            recommendations = await homeService.getRecommendedVaccines(parseInt(childId));
        }

        res.render("client/book-appointment", { 
            children, 
            vaccines, 
            recommendations,
            selectedChildId: childId || null 
        });
    } catch (error) {
        res.redirect("/client/dashboard");
    }
});

router.post("/appointments/book", isParent, async (req, res) => {
    try {
        await homeService.bookAppointment(req.user.id, req.body, req.user.role);
        res.redirect("/client/dashboard");
    } catch (error) {
        const children = await homeService.getChildrenForBooking(req.user.id, req.user.role);
        const vaccines = await homeService.getVaccinesForBooking();
        res.render("client/book-appointment", { 
            children, 
            vaccines, 
            recommendations: [],
            selectedChildId: req.body.childId,
            error: error.message 
        });
    }
});

router.get("/client/schedule", isParent, async (req, res) => {
    res.render("client/schedule");
});

router.get("/client/growth", isParent, async (req, res) => {
    res.render("client/growth");
});

router.get("/client/vaccines/:id", isParent, async (req, res) => {
    res.render("client/vaccine_detail");
});

module.exports = router;
