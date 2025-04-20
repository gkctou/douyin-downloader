
/**
 * 抖音API参数接口
 */
interface APIParams {
  device_platform: string;
  aid: string;
  channel: string;
  update_version_code: string;
  pc_client_type: string;
  pc_libra_divert: string;
  version_code: string;
  version_name: string;
  cookie_enabled: string;
  screen_width: string;
  screen_height: string;
  browser_language: string;
  browser_platform: string;
  browser_name: string;
  browser_version: string;
  browser_online: string;
  engine_name: string;
  engine_version: string;
  os_name: string;
  os_version: string;
  cpu_core_num: string;
  device_memory: string;
  platform: string;
  downlink: string;
  effective_type: string;
  round_trip_time: string;
  [key: string]: string;
}

/**
 * 抖音用户抓取选项
 */
export interface DouyinUserOptions {
  tab?: 'post' | 'favorite';
  earliest?: string | number;
  latest?: string;
  pages?: number;
  cursor?: number;
  count?: number;
  maxItems?: number;
  proxy?: string;
  outputPath?: string;
}

/**
 * 抖音用户作品数据
 */
interface DouyinWorkItem {
  aweme_id: string;
  desc: string;
  create_time: number;
  author: {
    nickname: string;
    uid: string;
    unique_id: string;
    signature: string;
  };
  statistics: {
    comment_count: number;
    digg_count: number;
    play_count: number;
    share_count: number;
  };
  video?: {
    play_addr: {
      url_list: string[];
    };
  };
  [key: string]: any;
}

/**
 * 将Cookie字符串转换为JSON对象
 */
function convertCookieToJSON(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const pairs = cookieStr.split(/;\s*/);

  for (const pair of pairs) {
    // 处理特殊情况，值中可能包含等号
    const firstEqual = pair.indexOf('=');
    if (firstEqual !== -1) {
      const key = pair.substring(0, firstEqual);
      const value = pair.substring(firstEqual + 1);
      // 解码cookie值
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}

/**
 * 将Cookie对象格式化为头部字符串
 */
function formatCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('; ');
}

/**
 * 抖音基础API类
 */
class BaseAPI {
  protected domain = 'https://www.douyin.com/';
  protected shortDomain = 'https://www.iesdouyin.com/';
  protected referer = `${this.domain}?recommend=1`;
  protected api = '';
  protected headers: Record<string, string>;
  protected cookieObj: Record<string, string> = {};
  protected cursor = 0;
  protected response: any[] = [];
  protected finished = false;
  protected pages = 99999;

  constructor(
    protected params: APIParams,
    protected cookieStr?: string,
    protected proxy?: string,
    protected timeout = 10000,
    protected maxRetry = 3
  ) {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Referer': this.referer,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-SG,zh;q=0.9',
    };

    if (cookieStr) {
      this.setTempCookie(cookieStr);
    }
  }

  protected setTempCookie(cookieStr?: string): void {
    cookieStr && (this.headers['Cookie'] = cookieStr || '');
    // if (cookieStr) {
    //   // 确保使用正确的cookie解析，处理复杂的cookie值
    //   this.cookieObj = convertCookieToJSON(cookieStr);
    //   this.headers['Cookie'] = formatCookieHeader(this.cookieObj);
    // }
  }

  protected setReferer(url?: string): void {
    this.headers['Referer'] = url || this.referer;
  }

  protected generateParams(): Record<string, string> {
    return { ...this.params };
  }

  protected dealUrlParams(params: Record<string, any>): string {
    if (!params) return '';

    // 转换参数为查询字符串
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return queryString;
  }

  async requestData(
    url: string,
    params?: Record<string, any>,
    data?: Record<string, any>,
    method: string = 'GET',
    headers?: Record<string, string>
  ): Promise<any> {
    const queryString = this.dealUrlParams(params || this.generateParams());
    const requestUrl = `${url}?${queryString}`;
    const requestHeaders = headers || this.headers;

    try {
      // 重试机制
      let retries = 0;
      let response: Response;

      while (retries <= this.maxRetry) {
        try {
          const fetchOptions: RequestInit = {
            method,
            headers: requestHeaders,
            // 添加代理支持需要使用代理服务器或环境变量
            signal: AbortSignal.timeout(this.timeout)
          };

          // 如果是POST请求，添加请求体
          if (method === 'POST' && data) {
            fetchOptions.body = JSON.stringify(data);
            if (!fetchOptions.headers) fetchOptions.headers = {};
            (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
          }

          response = await fetch(requestUrl, fetchOptions);

          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const responseData = await response.json();
          return responseData;
        } catch (err) {
          retries++;
          if (retries > this.maxRetry) {
            throw err;
          }
          // 重试前等待
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    } catch (error) {
      console.error(`请求失败: ${url}`, error);
      throw error;
    }
  }

  protected checkResponse(
    data: any,
    dataKey: string,
    errorText = '',
    cursor = 'cursor',
    hasMore = 'has_more'
  ): void {
    try {
      const dataList = data[dataKey];
      if (!dataList || dataList.length === 0) {
        console.log('数据列表为空，停止获取');
        this.finished = true;
        return;
      }

      // 保存上一个cursor值用于比较
      const previousCursor = this.cursor;

      // 抖音API的cursor处理逻辑
      if (data['max_cursor'] !== undefined) {
        this.cursor = data['max_cursor'];
      } else if (data[cursor] !== undefined) {
        this.cursor = data[cursor];
      }

      console.log(`获取到${dataList.length}条数据，当前cursor: ${this.cursor}`);
      this.appendResponse(dataList);

      // 检查是否还有更多数据
      let hasMoreData = true;
      if (data[hasMore] !== undefined) {
        // 将hasMore转换为布尔值
        const hasMoreValue = String(data[hasMore]);
        hasMoreData = hasMoreValue !== '0' && hasMoreValue.toLowerCase() !== 'false';
        console.log(`hasMore值: ${data[hasMore]}, 是否有更多数据: ${hasMoreData}`);
      }

      // 检查cursor是否有变化
      const cursorChanged = String(this.cursor) !== String(previousCursor);
      console.log(`cursor变化: ${previousCursor} -> ${this.cursor}, 是否变化: ${cursorChanged}`);

      // 只有当没有更多数据或cursor没有变化时才停止
      this.finished = !hasMoreData || !cursorChanged || dataList.length === 0;

      console.log(`是否继续获取: ${!this.finished}`);
    } catch (error) {
      console.error('检查响应时出错:', error);
      this.finished = true;
    }
  }

  protected appendResponse(data: any[]): void {
    this.response = [...this.response, ...data];
  }

  async runSingle(
    dataKey: string,
    errorText = '',
    cursor = 'cursor',
    hasMore = 'has_more',
    paramsFunc = () => ({}),
    dataFunc = () => ({}),
    method: string = 'GET',
    headers?: Record<string, string>
  ): Promise<void> {
    const data = await this.requestData(
      this.api,
      { ...this.generateParams(), ...paramsFunc() },
      dataFunc(),
      method,
      headers
    );

    if (data) {
      this.checkResponse(data, dataKey, errorText, cursor, hasMore);
    } else {
      this.finished = true;
    }
  }

  async runBatch(
    dataKey: string,
    errorText = '',
    cursor = 'cursor',
    hasMore = 'has_more',
    paramsFunc = () => ({}),
    dataFunc = () => ({}),
    method: string = 'GET',
    headers?: Record<string, string>,
    callback?: () => Promise<void>
  ): Promise<void> {
    // 初始页数计数器
    let pageCount = 0;
    // 增加一个安全限制，防止无限循环
    const maxSafetyLimit = 100;

    // 持续请求直到没有更多数据或达到页数限制
    console.log('开始分页请求, 页数限制:', this.pages);

    // 这里重置finished状态，确保循环能够正常开始
    this.finished = false;

    while (!this.finished && (this.pages === 0 || pageCount < this.pages) && pageCount < maxSafetyLimit) {
      console.log(`正在请求第${pageCount + 1}页数据...`);
      await this.runSingle(
        dataKey,
        errorText,
        cursor,
        hasMore,
        paramsFunc,
        dataFunc,
        method,
        headers
      );

      // 增加页数计数
      pageCount++;
      console.log(`完成第${pageCount}页请求，当前已获取数据总量: ${this.response.length}`);

      // 如果设置了回调函数，执行回调
      if (callback) {
        await callback();
      }

      // 防止过快请求，添加延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (pageCount >= maxSafetyLimit) {
      console.log(`达到最大安全页数限制(${maxSafetyLimit})，停止获取以防无限循环`);
    }

    console.log(`分页请求结束，总共获取${this.response.length}条数据，请求了${pageCount}页`);
  }

  async run(
    referer?: string,
    singlePage = false,
    dataKey = 'aweme_list',
    errorText = '',
    cursor = 'cursor',
    hasMore = 'has_more',
    paramsFunc = () => ({}),
    dataFunc = () => ({}),
    method: string = 'GET',
    headers?: Record<string, string>
  ): Promise<any> {
    this.setReferer(referer);

    if (singlePage) {
      await this.runSingle(
        dataKey,
        errorText,
        cursor,
        hasMore,
        paramsFunc,
        dataFunc,
        method,
        headers
      );
    } else {
      await this.runBatch(
        dataKey,
        errorText,
        cursor,
        hasMore,
        paramsFunc,
        dataFunc,
        method,
        headers
      );
    }

    return this.response;
  }
}

/**
 * 抖音账号API类
 */
export class DouyinAccountAPI extends BaseAPI {
  private postApi: string;
  private favoriteApi: string;
  private favorite: boolean;
  private secUserId: string;
  private earliest?: Date;
  private latest?: Date;
  private count: number;
  private text: string;

  constructor(
    params: APIParams,
    cookieStr?: string,
    proxy?: string,
    secUserId = '',
    tab: 'post' | 'favorite' = 'post',
    earliest: string | number = '',
    latest = '',
    pages?: number,
    cursor = 0,
    count = 18
  ) {
    super(params, cookieStr, proxy);

    this.postApi = `${this.domain}aweme/v1/web/aweme/post/`;
    this.favoriteApi = `${this.domain}aweme/v1/web/aweme/favorite/`;

    this.secUserId = secUserId;
    const [api, favorite, maxPages] = this.checkType(tab, pages || 99999);
    this.api = api;
    this.favorite = favorite;
    this.pages = maxPages;

    this.latest = this.checkLatest(latest);
    this.earliest = this.checkEarliest(earliest);
    this.cursor = cursor;
    this.count = count;

    this.text = favorite ? '账号喜欢作品' : '账号发布作品';
  }

  private checkType(tab: string, pages: number): [string, boolean, number] {
    switch (tab) {
      case 'favorite':
        return [this.favoriteApi, true, pages];
      case 'post':
      default:
        if (tab !== 'post') {
          console.warn(`tab参数 ${tab} 设置错误，程序将使用默认值: post`);
        }
        // 修正：确保无论是否为post类型，都使用传入的pages值，而不是固定的99999
        return [this.postApi, false, pages];
    }
  }

  private checkEarliest(dateStr: string | number): Date | undefined {
    const defaultDate = new Date(2016, 8, 20); // 2016年9月20日

    if (!dateStr) {
      return defaultDate;
    }

    if (typeof dateStr === 'number') {
      const earliest = new Date(this.latest || new Date());
      earliest.setDate(earliest.getDate() - dateStr);
      return earliest;
    } else if (typeof dateStr === 'string') {
      try {
        const [year, month, day] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
      } catch (error) {
        console.warn(`无效的最早日期: ${dateStr}`);
        return defaultDate;
      }
    }

    return defaultDate;
  }

  private checkLatest(dateStr: string): Date | undefined {
    const defaultDate = new Date();

    if (!dateStr) {
      return defaultDate;
    }

    try {
      const [year, month, day] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    } catch (error) {
      console.warn(`无效的最晚日期: ${dateStr}`);
      return defaultDate;
    }
  }

  protected generateParams(): Record<string, any> {
    return {
      device_platform: 'webapp',
      aid: '6383',
      channel: 'channel_pc_web',
      version_code: '170400',
      version_name: '17.4.0',
      cookie_enabled: 'true',
      screen_width: '1920',
      screen_height: '1080',
      browser_language: 'zh-CN',
      browser_platform: 'Win32',
      browser_name: 'Chrome',
      browser_version: '110.0.0.0',
      browser_online: 'true',
      engine_name: 'Blink',
      engine_version: '110.0.0.0',
      os_name: 'Windows',
      os_version: '10',
      cpu_core_num: '12',
      device_memory: '8',
      platform: 'PC',
      downlink: '10',
      effective_type: '4g',
      round_trip_time: '50',
      webid: Date.now(),
      msToken: '',
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  private generateFavoriteParams(): Record<string, any> {
    // 确保生成正确的参数
    console.log(`生成收藏参数，当前cursor: ${this.cursor}`);
    return {
      ...super.generateParams(),
      sec_user_id: this.secUserId,
      max_cursor: this.cursor,
      min_cursor: '0',
      whale_cut_token: '',
      cut_version: '1',
      count: this.count,
      publish_video_strategy_type: '2',
      version_code: '170400',
      version_name: '17.4.0',
    };
  }

  private generatePostParams(): Record<string, any> {
    // 确保生成正确的参数
    console.log(`生成发布参数，当前cursor: ${this.cursor}`);
    return {
      ...super.generateParams(),
      sec_user_id: this.secUserId,
      max_cursor: this.cursor,
      locate_query: 'false',
      show_live_replay_strategy: '1',
      need_time_list: '1',
      time_list_query: '0',
      whale_cut_token: '',
      cut_version: '1',
      count: this.count,
      publish_video_strategy_type: '2',
    };
  }

  async earlyStop(): Promise<void> {
    // 如果数据发布日期早于限制日期，不再获取下一页
    if (
      !this.favorite &&
      this.earliest &&
      this.cursor &&
      new Date(parseInt(String(this.cursor)) / 1000) < this.earliest
    ) {
      this.finished = true;
    }
  }

  async run(
    referer?: string,
    singlePage = false
  ): Promise<any> {
    if (this.favorite) {
      this.setReferer(`${this.domain}user/${this.secUserId}?showTab=like`);
    } else {
      this.setReferer(`${this.domain}user/${this.secUserId}`);
    }

    try {
      // 保存响应，以便检查问题
      let lastResponse: any = null;

      // 如果仅抓取单页，则直接调用runSingle
      if (singlePage) {
        await this.runSingle(
          'aweme_list',
          `无法获取${this.text}`,
          'max_cursor',
          'has_more',
          this.favorite ? () => this.generateFavoriteParams() : () => this.generatePostParams(),
          () => ({}),
          'GET'
        );
      } else {
        // 手动执行分页请求，绕过runBatch
        let pageCount = 0;
        const maxPages = 100; // 安全限制
        let hasMore = true;

        console.log(`开始手动分页请求，最大页数限制: ${maxPages}`);

        while (hasMore && pageCount < maxPages) {
          console.log(`正在请求第${pageCount + 1}页数据，当前cursor: ${this.cursor}`);

          // 构建请求参数
          const params = this.favorite ? this.generateFavoriteParams() : this.generatePostParams();
          console.log(`请求参数: max_cursor=${params.max_cursor}`);

          // 发送请求
          const response = await this.requestData(
            this.api,
            params,
            {},
            'GET'
          );

          lastResponse = response;

          if (!response || !response.aweme_list || response.aweme_list.length === 0) {
            console.log('响应无数据，停止请求');
            hasMore = false;
            break;
          }

          // 处理响应
          const dataList = response.aweme_list;
          console.log(`获取到${dataList.length}条数据`);
          this.appendResponse(dataList);

          // 更新cursor
          const oldCursor = this.cursor;
          this.cursor = response.max_cursor;
          console.log(`更新cursor: ${oldCursor} -> ${this.cursor}`);

          // 检查是否还有更多数据
          hasMore = response.has_more == 1;
          console.log(`是否还有更多数据: ${hasMore}, has_more值: ${response.has_more}`);

          // 检查cursor是否相同，如果相同则停止
          if (String(oldCursor) === String(this.cursor)) {
            console.log('cursor未变化，停止请求');
            hasMore = false;
            break;
          }

          pageCount++;
          console.log(`完成第${pageCount}页请求，当前数据总量: ${this.response.length}`);

          // 添加延迟，避免请求过快
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (pageCount >= maxPages) {
          console.log(`达到最大安全页数限制(${maxPages})，停止获取`);
        }

        console.log(`手动分页请求结束，总共获取${this.response.length}条数据，请求了${pageCount}页`);
      }

      // 返回抓取结果
      return this.response;
    } catch (error) {
      console.error(`运行错误: ${error}`);
      return this.response;
    }
  }
}

/**
 * 抖音用户数据抓取类
 */
export class DouyinUser {
  private DEFAULT_PARAMS: APIParams = {
    device_platform: 'webapp',
    aid: '6383',
    channel: 'channel_pc_web',
    update_version_code: '170400',
    pc_client_type: '1',
    pc_libra_divert: 'Windows',
    version_code: '290100',
    version_name: '29.1.0',
    cookie_enabled: 'true',
    screen_width: '1536',
    screen_height: '864',
    browser_language: 'zh-SG',
    browser_platform: 'Win32',
    browser_name: 'Chrome',
    browser_version: '125.0.0.0',
    browser_online: 'true',
    engine_name: 'Blink',
    engine_version: '125.0.0.0',
    os_name: 'Windows',
    os_version: '10',
    cpu_core_num: '16',
    device_memory: '8',
    platform: 'PC',
    downlink: '10',
    effective_type: '4g',
    round_trip_time: '200',
  }

  private cookie: string = '';

  constructor(cookie: string = '') {
    this.cookie = cookie;
  }

  /**
   * 从URL中解析用户ID
   */
  extractSecUserId(url: string): string {
    try {
      // 尝试直接从URL中提取sec_uid参数
      const match = url.match(/sec_uid=([^&]+)/);
      if (match && match[1]) {
        return match[1];
      }

      // 如果没有sec_uid参数，则尝试从user/后的路径中提取
      const userMatch = url.match(/\/user\/([^?&\/]+)/);
      if (userMatch && userMatch[1]) {
        return userMatch[1];
      }

      throw new Error('无法从URL中提取用户ID');
    } catch (error) {
      throw new Error('无法从URL中提取用户ID，请检查URL格式是否正确');
    }
  }

  /**
   * 获取抖音官方下载地址
   * 从视频URL列表中找出官方下载地址
   */
  getOfficialVideoUrl(urlList: string[] | undefined): string {
    if (!urlList || urlList.length === 0) return '';

    // API返回的url_list通常包含3个URL，最后一个是官方下载地址
    // 直接检查每个URL，返回官方格式的链接
    for (const url of urlList) {
      if (url.includes('douyin.com/aweme/v1/play')) {
        return url;
      }
    }

    // 如果没有找到官方链接，则返回第一个链接作为后备
    return urlList[0];
  }

  /**
   * 将用户作品数据导出为JSON文件
   */
  async exportToJson(works: DouyinWorkItem[]): Promise<DouyinWorkItem[]> {
    // 准备JSON数据
    return works.map(work => {
      // const createTime = new Date(work.create_time * 1000);

      // 获取视频链接
      let videoUrl = '';
      if (work.video && work.video.play_addr && work.video.play_addr.url_list) {
        videoUrl = this.getOfficialVideoUrl(work.video.play_addr.url_list);
      }

      return {
        aweme_id: work.aweme_id,
        desc: work.desc,
        create_time: work.create_time * 1000,//createTime.toLocaleString(),
        author: {
          nickname: work.author?.nickname || '',
          uid: work.author?.uid || '',
          unique_id: work.author?.unique_id || '',
          signature: work.author?.signature || '',
        },
        statistics: {
          comment_count: work.statistics?.comment_count || 0,
          digg_count: work.statistics?.digg_count || 0,
          play_count: work.statistics?.play_count || 0,
          share_count: work.statistics?.share_count || 0,
        },
        video_url: videoUrl
      };
    });

    // 确定输出路径
    // const fileName = `抖音用户作品_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    // const filePath = outputPath ? path.join(outputPath, fileName) : fileName;

    // // 写入文件
    // await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');

    // return filePath;
  }

  /**
   * 完整流程：获取用户作品并导出
   */
  async fetchAndExport(userUrl: string, options: DouyinUserOptions = {}): Promise<DouyinWorkItem[]> {
    // 1. 获取用户数据
    const works = await this.fetchUserWorks(userUrl, options);

    // 2. 导出数据
    return this.exportToJson(works);
  }

  /**
   * 获取用户作品数据
   */
  async fetchUserWorks(userUrl: string, options: DouyinUserOptions = {}): Promise<DouyinWorkItem[]> {
    const secUserId = this.extractSecUserId(userUrl);
    console.log(`正在获取用户作品, secUserId: ${secUserId}`);

    // 设置最大抓取数量
    const maxItems = options.maxItems || 0;
    let allWorks: DouyinWorkItem[] = [];

    // 初始化API
    const accountAPI = new DouyinAccountAPI(
      this.DEFAULT_PARAMS,
      this.cookie,
      options.proxy,
      secUserId,
      options.tab || 'post',
      options.earliest || '',
      options.latest || '',
      // 页数设置
      options.pages || 0,
      options.cursor || 0,
      // 每页条数设置
      options.count || 35
    );

    console.log('开始获取数据...');

    try {
      // 抓取数据
      const result = await accountAPI.run();
      console.log(`获取完成，共获取${Array.isArray(result) ? result.length : '未知数量'}条数据`);

      let works = Array.isArray(result) ? result : [];

      // 如果设置了最大条数限制，截取需要的部分
      if (maxItems > 0 && works.length > maxItems) {
        console.log(`截取前${maxItems}条数据，原始数据共${works.length}条`);
        works = works.slice(0, maxItems);
      }

      return works;
    } catch (error) {
      console.error('获取用户作品时出错:', error);
      throw error;
    }
  }
}

