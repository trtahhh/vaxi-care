const { AppDataSource } = require("../data-source");

const childRepo = () => AppDataSource.getRepository("Child");

// GET /api/children - Lấy danh sách trẻ của parent đang đăng nhập
exports.getMyChildren = async (req, res) => {
    try {
        const children = await childRepo().find({
            where: { parent: { id: req.user.id } },
            order: { name: "ASC" },
        });
        res.json(children);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// POST /api/children - Thêm hồ sơ trẻ
exports.addChild = async (req, res) => {
    try {
        const { name, dob, gender } = req.body;
        if (!name || !dob || !gender) {
            return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin của trẻ." });
        }

        const repo = childRepo();
        const child = repo.create({
            name,
            dob,
            gender,
            parent: { id: req.user.id },
        });
        await repo.save(child);
        res.status(201).json({ message: "Thêm hồ sơ trẻ thành công.", child });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// PATCH /api/children/:id - Cập nhật hồ sơ trẻ
exports.updateChild = async (req, res) => {
    try {
        const { id } = req.params;
        const repo = childRepo();

        const child = await repo.findOne({
            where: { id: parseInt(id), parent: { id: req.user.id } },
        });
        if (!child) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ trẻ." });
        }

        const { name, dob, gender } = req.body;
        if (name) child.name = name;
        if (dob) child.dob = dob;
        if (gender) child.gender = gender;

        await repo.save(child);
        res.json({ message: "Cập nhật thành công.", child });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// DELETE /api/children/:id - Xóa hồ sơ trẻ
exports.deleteChild = async (req, res) => {
    try {
        const { id } = req.params;
        const repo = childRepo();

        const child = await repo.findOne({
            where: { id: parseInt(id), parent: { id: req.user.id } },
        });
        if (!child) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ trẻ." });
        }

        await repo.remove(child);
        res.json({ message: "Xóa hồ sơ trẻ thành công." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};
