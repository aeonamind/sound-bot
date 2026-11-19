import { type DauTrauTrait, type DeathStats, strongestTrait } from "./timeline";

// Placeholders: {name} in-game name, {champ} champion, {n} count, {n1} count + 1.

/** Generic lines for a gà whose team lost. */
const ROASTS_LOSS = [
	"{name} chơi {champ} như lần đầu cầm chuột.",
	"Team thua không phải tại {name}... à mà đúng là tại {name}.",
	"{name} cầm {champ} mà tưởng đang chơi chế độ hướng dẫn.",
	"Nhà tài trợ chính cho đội bạn trận này: {name}.",
	"{name} đề nghị gỡ game, cài lại, rồi gỡ tiếp.",
	"Địch muốn gửi lời cảm ơn tới {name} vì sự hỗ trợ nhiệt tình.",
	"{name} feed đều như cơm bữa, {champ} khóc thét.",
	"{name} mở shop từ thiện, mạng miễn phí cho đội bạn.",
	"Bản đồ có 3 đường, {name} đi lạc cả 3.",
	"{name} chơi {champ} như đang cầm vô lăng xe tải trong ngõ hẻm.",
	"Đội bạn đề nghị mời {name} vào team chính thức.",
	"{name} đã chứng minh: chết nhiều cũng là một kỹ năng.",
	"Nút B của {name} chắc bị hỏng, từ đầu trận tới giờ chưa về nhà lần nào.",
	"{name} thả {champ} vào trận như thả gà vào chuồng cọp.",
	// đầu trâu: chơi dở
	"Trận này team có 4 người và 1 cái đầu trâu tên {name}.",
	"{name} đem bộ não đầu trâu vào Summoner's Rift, {champ} khóc không thành tiếng.",
	"Tưởng {name} cầm {champ} là gánh, ai ngờ gánh nguyên cái đầu trâu.",
	"Giải Đầu Trâu Vàng mùa này xin trao cho {name}.",
	"{name} chơi {champ} kiểu đầu trâu: không mắt, không não, chỉ có sừng.",
	// đầu trâu: lì lợm (also used when the timeline matches)
	"Bảo lùi thì không lùi, bảo farm thì không farm. {name} đúng chuẩn đầu trâu.",
	"Ping lui 10 lần vẫn lao lên. Đầu trâu {name} không nghe ai bao giờ.",
];

/** Lines picked when the timeline shows a specific "đầu trâu" behaviour (loss only). */
const DAU_TRAU_LINES: Record<DauTrauTrait, string[]> = {
	sameSpot: [
		"{name} đầu trâu thật sự, chết {n} lần ở cùng một chỗ vẫn quay lại lần thứ {n1}.",
	],
	streak: [
		"Bảo lùi thì không lùi, bảo farm thì không farm. {name} đúng chuẩn đầu trâu.",
	],
	turretDives: [
		"{name} cầm {champ} húc thẳng vào trụ như đầu trâu, kết quả thì ai cũng biết.",
	],
	quickRedeaths: [
		"Ping lui 10 lần vẫn lao lên. Đầu trâu {name} không nghe ai bao giờ.",
	],
	outnumbered: [
		"{name} đầu trâu mặt ngựa, cứ thấy địch là lao vào, không cần biết mấy đứa.",
	],
};

/** The gà's team won anyway. */
const ROASTS_WIN = [
	"Thắng rồi nhưng {name} vẫn là con gà, được đồng đội gánh còng lưng.",
	"{name} lên xe bus thành công, tài xế cảm ơn quý khách.",
	"Cả team thắng, riêng {name} thì không.",
	"{name} đóng vai trò tạ tập gym cho đồng đội.",
	"Thắng là nhờ đồng đội, còn {name} là nhờ may mắn.",
	"{name} hôm nay làm khán giả có vé VIP, ngồi xem team gánh.",
	"Đầu trâu {name} được kéo về đích, nhớ cảm ơn đồng đội nhé.",
	"{name} góp công vào chiến thắng bằng cách không chết thêm.",
];

const MVP_LINES = [
	"{name} gánh cả nhóm trên vai.",
	"{name} chơi như thật sự biết chơi.",
	"{name}: đẳng cấp khác biệt.",
	"{name} cầm {champ} như lập trình viên cầm bàn phím.",
	"{name} một mình cân cả team, team mình lẫn team bạn.",
	"Trâu thật sự là {name}, gánh cả nhóm không than một lời.",
];

function fill(
	template: string,
	vars: { name: string; champ: string; n?: number },
): string {
	const n = vars.n ?? 0;
	return template
		.replaceAll("{name}", vars.name)
		.replaceAll("{champ}", vars.champ)
		.replaceAll("{n1}", String(n + 1))
		.replaceAll("{n}", String(n));
}

function randomOf<T>(items: T[], random: () => number): T {
	return items[Math.floor(random() * items.length)];
}

export interface RoastTarget {
	name: string;
	championName: string;
	win: boolean;
	deathStats?: DeathStats;
}

export function gaRoast(
	p: RoastTarget,
	random: () => number = Math.random,
): string {
	const vars = { name: p.name, champ: p.championName };
	if (p.win) return fill(randomOf(ROASTS_WIN, random), vars);

	const trait = strongestTrait(p.deathStats);
	if (trait) {
		return fill(randomOf(DAU_TRAU_LINES[trait.trait], random), {
			...vars,
			n: trait.value,
		});
	}
	return fill(randomOf(ROASTS_LOSS, random), vars);
}

export function mvpLine(
	name: string,
	champ: string,
	random: () => number = Math.random,
): string {
	return fill(randomOf(MVP_LINES, random), { name, champ });
}
