const ROASTS_LOSS = [
	"{name} chơi {champ} như lần đầu cầm chuột.",
	"Team thua không phải tại {name}... à mà đúng là tại {name}.",
	"{name} cầm {champ} mà tưởng đang chơi chế độ hướng dẫn.",
	"Nhà tài trợ chính cho đội bạn trận này: {name}.",
	"{name} đề nghị gỡ game, cài lại, rồi gỡ tiếp.",
	"Địch muốn gửi lời cảm ơn tới {name} vì sự hỗ trợ nhiệt tình.",
	"{name} feed đều như cơm bữa, {champ} khóc thét.",
];

const ROASTS_WIN = [
	"Thắng rồi nhưng {name} vẫn là con gà, được đồng đội gánh còng lưng.",
	"{name} lên xe bus thành công, tài xế cảm ơn quý khách.",
	"Cả team thắng, riêng {name} thì không.",
	"{name} đóng vai trò tạ tập gym cho đồng đội.",
];

const MVP_LINES = [
	"{name} gánh cả nhóm trên vai.",
	"{name} chơi như thật sự biết chơi.",
	"{name}: đẳng cấp khác biệt.",
];

function fill(template: string, name: string, champ: string): string {
	return template.replaceAll("{name}", name).replaceAll("{champ}", champ);
}

function randomOf<T>(items: T[], random: () => number): T {
	return items[Math.floor(random() * items.length)];
}

export function gaRoast(
	name: string,
	champ: string,
	win: boolean,
	random: () => number = Math.random,
): string {
	return fill(randomOf(win ? ROASTS_WIN : ROASTS_LOSS, random), name, champ);
}

export function mvpLine(
	name: string,
	champ: string,
	random: () => number = Math.random,
): string {
	return fill(randomOf(MVP_LINES, random), name, champ);
}
