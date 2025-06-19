// server/utils/randomInfoGenerator.js

const firstNames = [
    // 常见女性姓氏
    "李", "王", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
    "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
    "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧",
    "程", "曹", "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕",
    "苏", "卢", "蒋", "蔡", "贾", "丁", "魏", "薛", "叶", "阎",
    "余", "潘", "杜", "戴", "夏", "钟", "汪", "田", "任", "姜",
    "范", "方", "石", "姚", "谭", "廖", "邹", "熊", "金", "陆",
    "郝", "孔", "白", "崔", "康", "毛", "邱", "秦", "江", "史",
    "顾", "侯", "邵", "孟", "龙", "万", "段", "漕", "钱", "汤"
];

const lastNamesSingle = [
    "芳", "娜", "敏", "静", "丽", "娟", "秀", "霞", "桂", "丹", "红", "艳", "慧", "玉", "雪", "梅", "莉", "琴", "燕", "荣", "洁", "玲", "霞", "倩", "婷", "雪梅", "玉梅", "春燕", "秋霞", "玉珍", "美玲", "美华", "美丽", "美玉", "美珍", "美娟", "美英", "美兰", "美霞", "美琴", "美慧", "美芳", "美娜", "美静", "美红", "美敏", "美丽", "美娟", "美秀", "美霞", "美丹", "美英", "美玉", "美琴", "美慧", "美芳", "美娜", "美静", "美红", "美敏"
];

const lastNamesDouble = [
    "子涵", "雨萱", "梓涵", "欣怡", "依诺", "雨涵", "诗涵", "嘉怡", "若曦", "语桐", "思远", "晨曦", "梦琪", "欣妍", "思彤", "可馨", "佳琪", "思睿", "文昊", "思怡", "雅静", "雅丽", "雅芳", "雅琴", "雅慧", "雅娜", "雅红", "雅敏", "雅丽", "雅娟", "雅秀", "雅霞", "雅丹", "雅英", "雅玉", "雅琴", "雅慧", "雅芳", "雅娜", "雅静", "雅红", "雅敏"
];

const adminDivisions = [
    {
        provinceName: "江西省", provinceCodeShort: "36",
        cities: [
            {
                cityName: "南昌市",
                districts: [
                    {name: "东湖区", code: "360102"},
                    {name: "青山湖区", code: "360111"},
                    {name: "新建区", code: "360112"}
                ]
            }
        ]
    },
    {
        provinceName: "湖南省", provinceCodeShort: "43",
        cities: [
            {
                cityName: "长沙市",
                districts: [
                    {name: "芙蓉区", code: "430102"},
                    {name: "天心区", code: "430103"},
                    {name: "岳麓区", code: "430104"},
                    {name: "开福区", code: "430105"},
                    {name: "雨花区", code: "430111"},
                    {name: "长沙县", code: "430121"}
                ]
            },
            {
                cityName: "株洲市",
                districts: [
                    {name: "天元区", code: "430211"},
                    {name: "芦淞区", code: "430203"},
                    {name: "石峰区", code: "430204"}
                ]
            }
        ]
    },
    {
        provinceName: "广东省", provinceCodeShort: "44",
        cities: [
            {
                cityName: "深圳市",
                districts: [
                    {name: "罗湖区", code: "440303"},
                    {name: "福田区", code: "440304"},
                    {name: "南山区", code: "440305"},
                    {name: "宝安区", code: "440306"},
                    {name: "龙岗区", code: "440307"}
                ]
            },
            {
                cityName: "广州市",
                districts: [
                    {name: "天河区", code: "440106"},
                    {name: "越秀区", code: "440104"},
                    {name: "海珠区", code: "440105"},
                    {name: "荔湾区", code: "440103"},
                    {name: "白云区", code: "440111"}
                ]
            }
        ]
    },
    {
        provinceName: "北京市", provinceCodeShort: "11", // 直辖市
        cities: [
            { // 北京市的市级单位通常就是其本身，区直接在"cities"下一层表示
                cityName: "北京市",
                districts: [
                    {name: "东城区", code: "110101"},
                    {name: "西城区", code: "110102"},
                    {name: "朝阳区", code: "110105"},
                    {name: "海淀区", code: "110108"},
                    {name: "丰台区", code: "110106"},
                    {name: "通州区", code: "110112"}
                ]
            }
        ]
    },
    {
        provinceName: "上海市", provinceCodeShort: "31", // 直辖市
        cities: [
            {
                cityName: "上海市",
                districts: [
                    {name: "黄浦区", code: "310101"},
                    {name: "徐汇区", code: "310104"},
                    {name: "长宁区", code: "310105"},
                    {name: "静安区", code: "310106"},
                    {name: "普陀区", code: "310107"},
                    {name: "浦东新区", code: "310115"}
                ]
            }
        ]
    },
    {
        provinceName: "四川省", provinceCodeShort: "51",
        cities: [
            {
                cityName: "成都市",
                districts: [
                    {name: "锦江区", code: "510104"},
                    {name: "青羊区", code: "510105"},
                    {name: "金牛区", code: "510106"},
                    {name: "武侯区", code: "510107"},
                    {name: "成华区", code: "510108"},
                    {name: "龙泉驿区", code: "510112"},
                    {name: "双流区", code: "510116"}
                ]
            },
            {
                cityName: "绵阳市",
                districts: [
                    {name: "涪城区", code: "510703"},
                    {name: "游仙区", code: "510704"},
                    {name: "安州区", code: "510724"}
                ]
            }
        ]
    },
    {
        provinceName: "山东省", provinceCodeShort: "37",
        cities: [
            {
                cityName: "济南市",
                districts: [
                    {name: "历下区", code: "370102"},
                    {name: "市中区", code: "370103"},
                    {name: "槐荫区", code: "370104"},
                    {name: "天桥区", code: "370105"},
                    {name: "历城区", code: "370112"}
                ]
            },
            {
                cityName: "青岛市",
                districts: [
                    {name: "市南区", code: "370202"},
                    {name: "市北区", code: "370203"},
                    {name: "黄岛区", code: "370211"},
                    {name: "崂山区", code: "370212"},
                    {name: "即墨区", code: "370215"}
                ]
            }
        ]
    },
    {
        provinceName: "河南省", provinceCodeShort: "41",
        cities: [
            {
                cityName: "郑州市",
                districts: [
                    {name: "中原区", code: "410102"},
                    {name: "二七区", code: "410103"},
                    {name: "金水区", code: "410105"},
                    {name: "惠济区", code: "410108"},
                    {name: "管城回族区", code: "410104"}
                ]
            },
            {
                cityName: "洛阳市",
                districts: [
                    {name: "老城区", code: "410302"},
                    {name: "西工区", code: "410303"},
                    {name: "瀍河回族区", code: "410304"},
                    {name: "涧西区", code: "410305"},
                    {name: "洛龙区", code: "410311"}
                ]
            }
        ]
    },
    {
        provinceName: "浙江省", provinceCodeShort: "33",
        cities: [
            {
                cityName: "杭州市",
                districts: [
                    {name: "上城区", code: "330102"},
                    {name: "下城区", code: "330103"}, // Note: Hangzhou districts merged in 2021. This data is pre-merge.
                    {name: "江干区", code: "330104"}, // Merged
                    {name: "拱墅区", code: "330105"},
                    {name: "西湖区", code: "330106"},
                    {name: "滨江区", code: "330108"},
                    {name: "余杭区", code: "330110"}
                ]
            },
            {
                cityName: "宁波市",
                districts: [
                    {name: "海曙区", code: "330203"},
                    {name: "江北区", code: "330205"},
                    {name: "北仑区", code: "330206"},
                    {name: "镇海区", code: "330211"},
                    {name: "鄞州区", code: "330212"}
                ]
            }
        ]
    },
    {
        provinceName: "江苏省", provinceCodeShort: "32",
        cities: [
            {
                cityName: "南京市",
                districts: [
                    {name: "玄武区", code: "320102"},
                    {name: "秦淮区", code: "320104"},
                    {name: "建邺区", code: "320105"},
                    {name: "鼓楼区", code: "320106"},
                    {name: "雨花台区", code: "320114"},
                    {name: "江宁区", code: "320115"}
                ]
            },
            {
                cityName: "苏州市",
                districts: [
                    {name: "姑苏区", code: "320508"},
                    {name: "虎丘区", code: "320505"},
                    {name: "吴中区", code: "320506"},
                    {name: "相城区", code: "320507"},
                    {name: "吴江区", code: "320509"}
                ]
            }
        ]
    },
    {
        provinceName: "福建省", provinceCodeShort: "35",
        cities: [
            {
                cityName: "福州市",
                districts: [
                    {name: "鼓楼区", code: "350102"},
                    {name: "台江区", code: "350103"},
                    {name: "仓山区", code: "350104"},
                    {name: "马尾区", code: "350105"},
                    {name: "晋安区", code: "350111"}
                ]
            },
            {
                cityName: "厦门市",
                districts: [
                    {name: "思明区", code: "350203"},
                    {name: "海沧区", code: "350205"},
                    {name: "湖里区", code: "350206"},
                    {name: "集美区", code: "350211"},
                    {name: "同安区", code: "350212"},
                    {name: "翔安区", code: "350213"}
                ]
            }
        ]
    },
    {
        provinceName: "湖北省", provinceCodeShort: "42",
        cities: [
            {
                cityName: "武汉市",
                districts: [
                    {name: "江岸区", code: "420102"},
                    {name: "江汉区", code: "420103"},
                    {name: "硚口区", code: "420104"},
                    {name: "汉阳区", code: "420105"},
                    {name: "武昌区", code: "420106"},
                    {name: "洪山区", code: "420111"}
                ]
            },
            {
                cityName: "宜昌市",
                districts: [
                    {name: "西陵区", code: "420502"},
                    {name: "伍家岗区", code: "420503"},
                    {name: "点军区", code: "420504"},
                    {name: "猇亭区", code: "420505"},
                    {name: "夷陵区", code: "420506"}
                ]
            }
        ]
    }
    // Add more provinces, cities, and districts here for more variety
];

const roadNames = ["人民", "解放", "中山", "建设", "和平", "团结", "胜利", "光明", "中正", "延安", "北京", "上海", "广州", "长江", "黄河", "珠江", "世纪", "迎宾", "幸福", "平安", "健康", "发展", "科技", "创新", "文化", "教育", "体育", "花园", "公园", "中心", "湘江", "赣江", "沿江", "滨江"];
const roadSuffixes = ["路", "大道", "街", "巷", "胡同", "里", "弄", "大街", "小街", "中路", "南路", "北路", "东路", "西路"];

const buildingPrefixes = ["小区", "大厦", "花园", "家园", "广场", "中心", "公寓", "雅苑", "名邸", "国际", "科技园", "创业园"];
const buildingSuffixes = ["1号楼", "2号楼", "A座", "B座", "东单元", "西单元", "南座", "北座", "1栋", "甲单元", "综合楼", "办公楼"];

const occupations = [
    "教师", "护士", "文员", "收银员", "设计师", "会计师", "销售经理", "编辑", "演员", "项目经理", "服务员", "保洁员", "销售员", "客服专员", "店员", "幼师", "美容师", "美甲师", "会计", "演员", "家庭主妇", "保姆", "月嫂", "网店店主", "外卖员", "快递员", "司机", "厨师", "工厂工人", "学生", "待业",
    // 新增普通职业
    "超市理货员", "仓库管理员", "快餐店员", "服装导购", "理发师", "缝纫工", "保安", "前台接待", "电话客服", "资料员", "行政助理", "人事专员", "物业管理员", "社区工作人员", "家政服务员", "钟点工", "育婴师", "宠物美容师", "花店店员", "水果店员", "便利店员", "药店营业员", "图书管理员", "图文店员", "快照摄影师", "兼职", "自由职业", "临时工", "实习生", "无业", "待业中", "求职中", "灵活就业", "自由职业者", "短期工", "家里待业", "全职妈妈", "全职太太", "社区志愿者"
];

// Helper function to get a random element from an array
function getRandomElement(arr) {
    if (!arr || arr.length === 0) {
        return "";
    }
    return arr[Math.floor(Math.random() * arr.length)];
}

// Helper function to get a random integer between min and max (inclusive)
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateName() {
    const first = getRandomElement(firstNames);
    let last;
    if (Math.random() < 0.7) { // 70% chance for a single character last name
        last = getRandomElement(lastNamesSingle);
    } else {
        last = getRandomElement(lastNamesDouble);
    }
    return first + last;
}

function generatePhoneNumber() {
    const prefixes = ['130', '131', '132', '133', '134', '135', '136', '137', '138', '139',
                     '150', '151', '152', '153', '155', '156', '157', '158', '159',
                     '180', '181', '182', '183', '184', '185', '186', '187', '188', '189'];
    const prefix = getRandomElement(prefixes);
    const suffix = getRandomInt(10, 99).toString().padStart(2, '0');
    return `${prefix}******${suffix}`;
}

function generateAge() {
    return getRandomInt(18, 38); // 最高38岁
}

function generateOccupation() {
    return getRandomElement(occupations);
}

function generateRandomInfo() {
    const name = generateName();
    const phone = generatePhoneNumber();
    const age = generateAge();
    const occupation = generateOccupation();

    return {
        "姓名": name,
        "手机": phone,
        "年龄": age,
        "职业": occupation,
    };
}

module.exports = {
    generateRandomInfo,
    // Export other functions if they need to be used individually elsewhere,
    // for now, only the main function is exported.
}; 