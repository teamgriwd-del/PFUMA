"""Component-by-component connection list, straight from the veroboard design."""
import sys, collections
sys.path.insert(0, ".")
import vero

DEVL = ["3V3","EN","VP/IO36","VN/IO39","IO34","IO35","IO32","IO33","IO25","IO26",
        "IO27","IO14","IO12","GND","IO13","SD2","SD3","CMD","5V"]
DEVR = ["GND","IO23","IO22","TX0","RX0","IO21","GND","IO19","IO18","IO5","IO17",
        "IO16","IO4","IO0","IO2","IO15","SD1","SD0","CLK"]
NUMLAB = {
 "U2_GPS":["VCC","RX","TX","GND"], "U3_OLED":["GND","VCC","SCL","SDA"],
 "U4_MPU":["VCC","GND","SCL","SDA","XDA","XCL","AD0","INT"],
 "U5_MAX":["VIN","GND","SCL","SDA","INT"],
 "REG":["GND  (pin 1)","3V3 OUT  (pin 2 + tab)","5V IN  (pin 3)"],
 "UART":["5V","GND","RX0","TX0"], "TEMP":["3V3  (red)","DATA  (yellow)","GND  (black)"],
 "BATT":["+ (red)","- (black)"], "DC":["+12V (centre)","GND (barrel)"],
 "TERM":["+5V  (pin 1)","GND  (pin 2)"],
 "LED":["cathode","anode"], "R":["end A","end B"],
}
RAIL = {"+3V3":"3V3 rail","GND":"GND rail","+5V":"5V rail","+12V":"12V input",
        "VBAT":"battery + (VBAT)"}
# ref -> (display name, label source) in the order they should be listed
ORDER = {
 "BS-02": [("CN1","5V input (screw terminal)","TERM"), ("U5","LM1117 3.3V regulator","REG"), ("U2","SX1278 Ra-02 LoRa","RAW"),
           ("U3","SSD1306 OLED","U3_OLED"), ("CN2","UART debug header","UART")],
 "CN-02": [("CN1","LiPo battery (JST)","BATT"), ("U7","TP4056 charger","RAW"),
           ("U9","MT3608 boost","RAW"), ("U8","LM1117 3.3V regulator","REG"),
           ("U3","SX1278 Ra-02 LoRa","RAW"), ("U2","NEO-6M GPS","U2_GPS"),
           ("U4","MPU-6050 (GY-521)","U4_MPU"), ("U5","MAX30102","U5_MAX"),
           ("CN3","DS18B20 probe","TEMP"), ("CN4","UART debug header","UART")],
}

def kind(n):
    if n in ("+3V3","+5V","+12V","VBAT"): return "pwr"
    if n == "GND": return "gnd"
    if n.startswith(("LORA","SPI")): return "spi"
    if n.startswith("I2C"): return "i2c"
    if n.startswith("GPS") or n in ("TX0","RX0"): return "uart"
    if n.startswith(("LED","K")): return "led"
    return "sig"

def build(fn):
    v, rows = fn()
    dev = {}                       # net -> GPIO name
    byref = collections.defaultdict(list)
    for c, r, n, t in v.pins:
        ref, _, pin = t.partition(".")
        if ref in ("U1A", "U1B"):
            if n and not n.startswith("NC_"):
                names = DEVL if ref == "U1A" else DEVR
                nm = names[int(pin) - 1]
                dev[n] = "GPIO" + nm[2:] if nm.startswith("IO") else nm
        else:
            byref[ref].append((pin, n, c, r))
    peers = collections.defaultdict(set)
    for c, r, n, t in v.pins:
        ref = t.split(".")[0]
        if ref not in ("U1A", "U1B") and n and not n.startswith("NC_"):
            peers[n].add(ref)
    return v, dev, byref, peers

def rows_for(board, fn):
    v, dev, byref, peers = build(fn)
    out = []
    for ref, name, src in ORDER[board]:
        if ref not in byref: continue
        items = []
        for pin, net, c, r in sorted(byref[ref], key=lambda q: (q[3], q[2])):
            lab = pin
            if pin.isdigit() and src in NUMLAB and int(pin) <= len(NUMLAB[src]):
                lab = NUMLAB[src][int(pin) - 1]
            if net in RAIL:
                dest = RAIL[net]
            elif net in dev:
                other = sorted(peers[net] - {ref})
                dest = dev[net] + ("  (also %s)" % ", ".join(other) if other else "")
            else:
                other = sorted(peers[net] - {ref})
                dest = "%s &rarr; %s" % (net, ", ".join(other)) if other else net
            items.append((kind(net), name, lab, dest, "col %d, row %d" % (c, r)))
        out.append((name, items))
    return out


# LED chains and the divider read better as chains than as pin pairs
CHAIN = {
 "BS-02": [("led", "Status LEDs", [
     ("LED_G", "green"), ("LED_B", "blue"), ("LED_Y", "yellow"), ("LED_R", "red")])],
 "CN-02": [("led", "Status LED", [("LED1_A", "")]),
           ("sig", "Battery divider", [])],
}

def chains(board, fn):
    v, dev, byref, peers = build(fn)
    out = []
    for k, title, lst in CHAIN.get(board, []):
        items = []
        if title.startswith("Battery"):
            items.append(("sig", "", "VBAT",
                "battery + &rarr; <b>R2 100k</b> &rarr; %s &rarr; <b>R3 100k</b> &rarr; GND rail"
                % dev.get("VBAT_SENSE", "GPIO34"), ""))
        for net, colour in lst:
            g = dev.get(net, net)
            items.append((k, "", g, "<b>330R</b> &rarr; LED %s anode &rarr; cathode &rarr; GND rail"
                          % colour if colour else "<b>330R</b> &rarr; LED anode &rarr; cathode &rarr; GND rail", ""))
        out.append((title, items))
    return out
