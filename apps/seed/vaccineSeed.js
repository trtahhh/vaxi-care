/**
 * Vaccine Seed Data
 * Run: node apps/seed/vaccineSeed.js
 * Or import: require('./apps/seed/vaccineSeed')
 */

const { AppDataSource } = require("../models/data-source");

const VACCINES = [
  // === VACCINE 6 TRONG 1 (Hexavalent) ===
  {
    name: "Hexaxim (6 trong 1)",
    description: "Vắc xin 6 trong 1 phối hợp phòng 6 bệnh: Bạch hầu, Ho gà, Uốn ván, Viêm gan B, Hib và Bại liệt. Tiêm từ 2 tháng tuổi, liều cơ bản 3 mũi, nhắc 1 mũi. Giảm số mũi tiêm, giảm đau cho trẻ.",
    price: 950000,
    stock: 50,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 2 tháng tuổi"
  },
  {
    name: "Infanrix Hexa (6 trong 1)",
    description: "Vắc xin 6 trong 1 của GSK, phối hợp phòng Bạch hầu, Ho gà, Uốn ván, Viêm gan B, Hib và Bại liệt. Công nghệ không cell, ít phản ứng phụ. Tiêm từ 2 tháng tuổi.",
    price: 1100000,
    stock: 40,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 2 tháng tuổi"
  },

  // === VACCINE 5 TRONG 1 ===
  {
    name: "Pentaxim (5 trong 1)",
    description: "Vắc xin 5 trong 1 phối hợp phòng Bạch hầu, Ho gà, Uốn ván, Hib và Bại liệt. Thiết kế không cell, an toàn cao. Tiêm từ 2 tháng tuổi, 3 liều cơ bản và 1 liều nhắc.",
    price: 850000,
    stock: 60,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 2 tháng tuổi"
  },
  {
    name: "Infanrix IPV (5 trong 1)",
    description: "Vắc xin 5 trong 1 của GSK, phối hợp phòng Bạch hầu, Ho gà, Uốn ván, Hib và Bại liệt. Công nghệ DTaP không cell, giảm phản ứng sau tiêm.",
    price: 980000,
    stock: 35,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 2 tháng tuổi"
  },

  // === VIÊM GAN B ===
  {
    name: "Viêm gan B (Euvax B)",
    description: "Vắc xin Viêm gan B tái tổ hợp loại non-A, sản xuất tại Hàn Quốc. Phòng vi rút viêm gan B lây qua đường máu và đường sinh dục. Tiêm 3 liều theo phác đồ 0-1-6 tháng.",
    price: 180000,
    stock: 80,
    recommendedAgeMonths: 0,
    ageLabel: "Trẻ sơ sinh & mọi lứa tuổi"
  },
  {
    name: "Viêm gan B (HBvaxpro)",
    description: "Vắc xin viêm gan B của MSD (Merck), đạt chuẩn quốc tế. Phòng lây nhiễm vi rút HBV. Chương trình tiêm chủng mở rộng miễn phí cho trẻ sơ sinh trong 24h sau sinh.",
    price: 220000,
    stock: 70,
    recommendedAgeMonths: 0,
    ageLabel: "Trẻ sơ sinh & mọi lứa tuổi"
  },

  // === CÁC LOẠI VIÊM GAN KHÁC ===
  {
    name: "Viêm gan A (Havrix 720)",
    description: "Vắc xin viêm gan A bất hoạt, sản xuất bởi GSK. Phòng viêm gan A lây qua đường tiêu hóa (thực phẩm, nước ô nhiễm). Tiêm 2 liều cách nhau 6-12 tháng, hiệu lực >20 năm.",
    price: 450000,
    stock: 55,
    recommendedAgeMonths: 12,
    ageLabel: "Trẻ từ 12 tháng tuổi"
  },
  {
    name: "Twinrix (Viêm gan A+B)",
    description: "Vắc xin phối hợp Viêm gan A và B, 2 in 1 của GSK. Giảm số mũi tiêm so với tiêm riêng từng loại. Tiêm 3 liều theo phác đồ 0-1-6 tháng.",
    price: 680000,
    stock: 30,
    recommendedAgeMonths: 12,
    ageLabel: "Trẻ từ 12 tháng & người lớn"
  },

  // === CÚM MÙA ===
  {
    name: "Cúm mùa (Vaxigrip tetra)",
    description: "Vắc xin cúm mùa 4 thành phần (tetravalent), cập nhật hàng năm theo khuyến cáo WHO. Phòng 4 chủng cúm: 2 chủng cúm A + 2 chủng cúm B. Tiêm hàng năm cho trẻ từ 6 tháng trở lên.",
    price: 350000,
    stock: 100,
    recommendedAgeMonths: 6,
    ageLabel: "Trẻ từ 6 tháng & người lớn"
  },
  {
    name: "Cúm mùa (Influvac tetra)",
    description: "Vắc xin cúm mùa 4 thành phần của Abbott. An toàn, ít phản ứng phụ. Đặc biệt khuyến nghị cho trẻ nhỏ, người cao tuổi và người có bệnh nền. Tiêm 1 liều/năm.",
    price: 380000,
    stock: 90,
    recommendedAgeMonths: 6,
    ageLabel: "Trẻ từ 6 tháng & người lớn"
  },

  // === VIÊM PHỔI / PHẾ CẦU ===
  {
    name: "Prevenar 13 (Phế cầu 13)",
    description: "Vắc xin phế cầu khuẩn liên hợp 13 thành phần (PCV13), phòng 13 serotype vi khuẩn Streptococcus pneumoniae gây viêm phổi, viêm màng não, nhiễm trùng huyết. Tiêm từ 2 tháng tuổi.",
    price: 1200000,
    stock: 45,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 2 tháng & người lớn"
  },
  {
    name: "Synflorix (Phế cầu 10)",
    description: "Vắc xin phế cầu khuẩn 10 thành phần của GSK. Phòng 10 serotype quan trọng nhất gây bệnh nặng ở trẻ em. Chương trình tiêm 4 liều: 2-4-6-12-15 tháng.",
    price: 950000,
    stock: 40,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 6 tuần đến 5 tuổi"
  },
  {
    name: "Pneumo 23",
    description: "Vắc xin phế cầu đa thành phần (23 serotype) cho người lớn và trẻ trên 2 tuổi có nguy cơ cao. Phòng viêm phổi, viêm màng não do phế cầu. Tiêm 1 liều, nhắc sau 5 năm.",
    price: 550000,
    stock: 25,
    recommendedAgeMonths: 24,
    ageLabel: "Trẻ từ 2 tuổi & người lớn"
  },

  // === ROTARIX (Cúm dạ dày) ===
  {
    name: "Rotarix (Cúm dạ dày)",
    description: "Vắc xin rotavirus tái tổ hợp kháng nguyên G1P[8], phòng viêm dạ dày ruột do rotavirus ở trẻ sơ sinh. Uống 2 liều cách nhau ít nhất 4 tuần, hoàn thành trước 24 tuần tuổi.",
    price: 550000,
    stock: 50,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 2 tháng, uống 2 liều"
  },
  {
    name: "Rota 5 (Cúm dạ dày)",
    description: "Vắc xin rotavirus 5 thành phần (pentavalent), phòng 5G[P] types chính gây tiêu chảy nặng ở trẻ. Uống 3 liều theo phác đồ 2-4-6 tháng tuổi.",
    price: 480000,
    stock: 45,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 2 tháng, uống 3 liều"
  },

  // === SỞI / MMR ===
  {
    name: "MMR (Sởi - Quai bị - Rubella)",
    description: "Vắc xin phối hợp 3 trong 1 phòng Sởi (Measles), Quai bị (Mumps) và Rubella (Sởi Đức). Tiêm 2 liều: mũi 1 từ 12-15 tháng, mũi 2 từ 4-6 tuổi hoặc 11-12 tuổi.",
    price: 320000,
    stock: 75,
    recommendedAgeMonths: 12,
    ageLabel: "Trẻ từ 12 tháng, tiêm 2 liều"
  },
  {
    name: "MMRV (Sởi - Quai bị - Rubella - Thủy đậu)",
    description: "Vắc xin 4 trong 1 phối hợp Sởi, Quai bị, Rubella và Thủy đậu. Giảm số mũi tiêm cho trẻ. Tiêm từ 12 tháng trở lên, 2 liều cách nhau ít nhất 6 tuần.",
    price: 850000,
    stock: 30,
    recommendedAgeMonths: 12,
    ageLabel: "Trẻ từ 12 tháng, tiêm 2 liều"
  },

  // === THỦY ĐẬU ===
  {
    name: "Varicella (Thủy đậu)",
    description: "Vắc xin thủy đậu sống giảm độc lực (Oka strain), phòng bệnh thủy đậu và biến chứng zona thần kinh sau này. Tiêm 2 liều: mũi 1 từ 12 tháng, mũi 2 cách mũi 1 ít nhất 6 tuần.",
    price: 420000,
    stock: 65,
    recommendedAgeMonths: 12,
    ageLabel: "Trẻ từ 12 tháng, tiêm 2 liều"
  },

  // === VIÊM MÀNG NÃO ===
  {
    name: "Meningococcal ACWY",
    description: "Vắc xin não mô cầu nhóm ACWY liên hợp, phòng viêm màng não và nhiễm trùng huyết do Neisseria meningitidis nhóm A, C, W, Y. Khuyến nghị cho trẻ trên 9 tháng và người lớn đi du lịch vùng dịch.",
    price: 980000,
    stock: 20,
    recommendedAgeMonths: 9,
    ageLabel: "Trẻ từ 9 tháng & người lớn"
  },
  {
    name: "Meningococcal B (Bexsero)",
    description: "Vắc xin não mô cầu nhóm B tái tổ hợp, phòng viêm màng não và nhiễm trùng huyết do Neisseria meningitidis nhóm B. Tiêm 2-3 liều tùy độ tuổi. Đặc biệt khuyến nghị cho trẻ nhỏ và thanh thiếu niên.",
    price: 1400000,
    stock: 15,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 2 tháng & thanh thiếu niên"
  },

  // === VIÊM NÃO NIPO ===
  {
    name: "Japanese Encephalitis (Viêm não Nhật Bản)",
    description: "Vắc xin viêm não Nhật Bản bất hoạt (JE-VC), phòng bệnh viêm não do virus JE lây qua muỗi Culex. Bắt buộc tiêm cho trẻ em tại các vùng có dịch. Tiêm 2 liều cơ bản + nhắc.",
    price: 580000,
    stock: 40,
    recommendedAgeMonths: 12,
    ageLabel: "Trẻ từ 12 tháng & người lớn"
  },

  // === DƯỠNG KHÍ / BẠI LIỆT ===
  {
    name: "Bại liệt (IPV - Polio bất hoạt)",
    description: "Vắc xin bại liệt bất hoạt (Inactivated Polio Vaccine), phòng bệnh bại liệt do virus polio type 1, 2, 3. Tiêm 4 liều theo phác đồ: 2, 4, 6-18 tháng và 4-6 tuổi.",
    price: 250000,
    stock: 60,
    recommendedAgeMonths: 2,
    ageLabel: "Trẻ từ 2 tháng, tiêm 4 liều"
  },

  // === HPV ===
  {
    name: "HPV 4 (Gardasil 4 - phòng 4 type)",
    description: "Vắc xin HPV tái tổ hợp phòng 4 type HPV 6, 11, 16, 18 gây ung thư cổ tử cung, âm hộ, âm đạo, hậu môn và mụn cóc sinh dục. Tiêm 3 liều cho nữ từ 9-26 tuổi.",
    price: 2400000,
    stock: 25,
    recommendedAgeMonths: 108,
    ageLabel: "Nữ từ 9-26 tuổi, 3 liều"
  },
  {
    name: "HPV 9 (Gardasil 9 - phòng 9 type)",
    description: "Vắc xin HPV 9 thành phần, phòng rộng nhất 9 type HPV (6, 11, 16, 18, 31, 33, 45, 52, 58). Phòng ~90% ung thư cổ tử cung và các bệnh liên quan HPV. Tiêm 2 liều cho nữ 9-14 tuổi, 3 liều từ 15 tuổi.",
    price: 3600000,
    stock: 15,
    recommendedAgeMonths: 108,
    ageLabel: "Nữ từ 9 tuổi, 2-3 liều"
  },

  // === DỊCH TẢ / THƯƠNG HÀN ===
  {
    name: "Typhoid Vi (Dịch tả thương hàn)",
    description: "Vắc xin thương hàn Vi polysaccharide, phòng vi khuẩn Salmonella typhi gây bệnh thương hàn. Khuyến nghị cho trẻ trên 2 tuổi và người lớn đi vùng dịch tả thương hàn. Tiêm 1 liều, nhắc mỗi 3 năm.",
    price: 320000,
    stock: 35,
    recommendedAgeMonths: 24,
    ageLabel: "Trẻ từ 2 tuổi & người lớn"
  },

  // === COVID-19 ===
  {
    name: "COVID-19 (Comirnaty - Pfizer)",
    description: "Vắc xin COVID-19 mRNA (Pfizer), phòng bệnh COVID-19 gây bởi virus SARS-CoV-2. Được WHO phê duyệt khẩn cấp. Tiêm theo hướng dẫn của Bộ Y tế, phù hợp từ 12 tuổi trở lên.",
    price: 0,
    stock: 0,
    recommendedAgeMonths: 144,
    ageLabel: "Từ 12 tuổi trở lên (theo Bộ Y tế)"
  },

  // === THAN (Tetanus) ===
  {
    name: "Uốn ván (Td vaccine)",
    description: "Vắc xin uốn ván bạch hầu liều thấp (Td), phòng uốn ván và bạch hầu cho người lớn và trẻ trên 7 tuổi. Nhắc mỗi 10 năm hoặc sau vết thương nghiêm trọng nếu quá 5 năm kể từ liều cuối.",
    price: 150000,
    stock: 80,
    recommendedAgeMonths: 84,
    ageLabel: "Trẻ từ 7 tuổi & người lớn"
  },

  // === DENGUE ===
  {
    name: "Dengue (Qdenga)",
    description: "Vắc xin sốt xuất huyết Dengue sống giảm độc lực (TAK-003), phòng 4 type virus dengue DENV-1, 2, 3, 4. Tiêm 2 liều cách nhau 3 tháng cho trẻ từ 6 tuổi trở lên, đặc biệt khuyến nghị ở vùng dịch.",
    price: 1800000,
    stock: 20,
    recommendedAgeMonths: 72,
    ageLabel: "Trẻ từ 6 tuổi, tiêm 2 liều"
  },

  // === ADAMANTANE (Dại) ===
  {
    name: "Bệnh Dại (Verorab)",
    description: "Vắc xin dại bất hoạt (Vero cell), phòng bệnh dại sau phơi nhiễm (cắn, cào, liếm vết thương) và dại phòng ngừa. Tiêm phác đồ 5 liều sau phơi nhiễm theo ngày 0, 3, 7, 14, 28.",
    price: 280000,
    stock: 30,
    recommendedAgeMonths: 0,
    ageLabel: "Mọi lứa tuổi (sau phơi nhiễm)"
  },
  {
    name: "Bệnh Dại (HDCV - Imovax)",
    description: "Vắc xin dại tế bào thai (Human Diploid Cell Vaccine), phòng bệnh dại. Đạt chuẩn WHO, hiệu quả cao. Tiêm phác đồ 5 liều sau phơi nhiễm ngay ngày 0, 3, 7, 14, 28 và tiêm huyết thanh dại (RIG) tại vết thương nếu cần.",
    price: 320000,
    stock: 25,
    recommendedAgeMonths: 0,
    ageLabel: "Mọi lứa tuổi (sau phơi nhiễm)"
  }
];

async function seedVaccines() {
  console.log("🔄 Initializing database connection...");
  await AppDataSource.initialize();
  console.log("✅ Database connected!");

  const repo = AppDataSource.getRepository("Vaccine");
  let inserted = 0;
  let skipped = 0;

  for (const v of VACCINES) {
    // Check if already exists
    const existing = await repo.findOne({ where: { name: v.name } });
    if (existing) {
      console.log(`  ⏭️  Bỏ qua (đã tồn tại): ${v.name}`);
      skipped++;
      continue;
    }

    const entity = repo.create(v);
    await repo.save(entity);
    console.log(`  ✅ Đã thêm: ${v.name} — ${new Intl.NumberFormat('vi-VN').format(v.price)}đ`);
    inserted++;
  }

  console.log(`\n📊 Kết quả seed:`);
  console.log(`   ✅ Thêm mới: ${inserted}`);
  console.log(`   ⏭️  Bỏ qua (đã có): ${skipped}`);
  console.log(`   📦 Tổng vaccine trong DB: ${await repo.count()}`);

  await AppDataSource.destroy();
  console.log("🔌 Database connection closed.");
}

// Run directly
if (require.main === module) {
  seedVaccines().catch(err => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
}

module.exports = { seedVaccines, VACCINES };
