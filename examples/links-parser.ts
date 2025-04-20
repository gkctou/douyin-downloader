import { extractDouyinLinks, resolveShortUrl } from "../src/douyin";
import fs from 'fs';
import path from 'path';
(async () => {
    const linksTxt = fs.readFileSync(path.join(__dirname, 'share-links.txt'), 'utf-8');
    // console.log('原始連結:', linksTxt);
    const links = extractDouyinLinks(linksTxt);
    console.log('提取的連結:', links);
    fs.writeFileSync(path.join(__dirname, 'extracted-links.json'), JSON.stringify(links, null, 2));
    const parsedLinks: string[] = [];
    for (const l of links) {
        try {
            const parsedLink = await resolveShortUrl(l);
            if (!parsedLink) {
                console.error(`無法解析連結: ${l}`);
                continue;
            }
            parsedLinks.push(parsedLink);
        } catch (error) {
            console.error(`解析連結失敗: ${l}`, error);
        }
    }
    console.log('解析結果:', parsedLinks);
    fs.writeFileSync(path.join(__dirname, 'parsed-links.json'), JSON.stringify(parsedLinks, null, 2));
    console.log('解析結果已寫入 parsed-links.json');
})();