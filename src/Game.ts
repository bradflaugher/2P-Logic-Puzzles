import Nonogram from './Nonogram'
import $ from './colors'
import Status from './status'

export default class Game extends Nonogram {
  handleSuccess: () => void
  handleAnimationEnd: () => void

  brush: Status
  draw: {
    firstI?: number
    firstJ?: number
    lastI?: number
    lastJ?: number
    inverted?: boolean
    mode?: 'empty' | 'filling'
    direction?: Direction
  }
  isPressed: boolean
  test: string

  gamepads: {
    index: number,
    buttons: string[],
    lastButtonsStatus: string,
  }[]
  players: { x: number, y: number }[]
  player_colors: { filled: string, unfilled: string}[]

  constructor(
    row: number[][],
    column: number[][],
    canvas: string | HTMLCanvasElement,
    {
      theme = {},
      onSuccess = () => { },
      onAnimationEnd = () => { },
    } = {},
  ) {
    super()
    this.theme.filledColor = $.blue
    this.theme.wrongColor = $.grey
    this.theme.isMeshed = true
    Object.assign(this.theme, theme)

    this.handleSuccess = onSuccess
    this.handleAnimationEnd = onAnimationEnd

    this.hints = {
      row: row.slice(),
      column: column.slice(),
    }
    this.removeNonPositiveHints()
    this.m = this.hints.row.length
    this.n = this.hints.column.length
    this.grid = new Array(this.m)
    for (let i = 0; i < this.m; i += 1) {
      this.grid[i] = new Array(this.n).fill(Status.UNSET)
    }
    this.hints.row.forEach((r, i) => { r.isCorrect = this.isLineCorrect('row', i) })
    this.hints.column.forEach((c, j) => { c.isCorrect = this.isLineCorrect('column', j) })

    this.initCanvas(canvas)

    this.brush = Status.FILLED
    this.draw = {}

    this.gamepads = []
    this.players = [ //assumes min 4x4 grid for 4 players
      { x: -1, y: -1 },
      { x: -1, y: -1 },
      { x: -1, y: -1 },
      { x: -1, y: -1 }
    ]
    this.player_colors = [
      { filled: $.p1f, unfilled: $.p1 },
      { filled: $.p2f, unfilled: $.p2 },
      { filled: $.p3f, unfilled: $.p3 },
      { filled: $.p4f, unfilled: $.p4 },
    ]

    this.print()
  }

  calculateHints(direction: Direction, i: number) {
    const hints: number[] = []
    const line = this.getSingleLine(direction, i)
    line.reduce((lastIsFilled, cell) => {
      if (cell === Status.FILLED) {
        hints.push(lastIsFilled ? <number>hints.pop() + 1 : 1)
      }
      return cell === Status.FILLED
    }, false)
    return hints
  }

  initListeners() {
    this.listeners = [
      ['mousedown', this.mousedown],
      ['mousemove', this.mousemove],
      ['mouseup', this.brushUp],
      ['mouseleave', this.brushUp]
    ]
    window.addEventListener('gamepadconnected', this.connectHandler)
    window.addEventListener('gamepaddisconnected', this.disconnectHandler)
    window.requestAnimationFrame(this.buttonHandler)
  }

  connectHandler = (e: GamepadEvent) => {
    this.gamepads.push({
      index: e.gamepad.index,
      buttons: [
        'A',
        'B',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'U',
        'D',
        'L',
        'R',
        ''], // TODO detect/support more than XB1 controllers
      lastButtonsStatus: "",
    })

    this.players[e.gamepad.index] = { x: 1, y: e.gamepad.index }
  }

  disconnectHandler = (e: GamepadEvent) => {
    for (let i = 0; i < this.gamepads.length; i++) {
      if (e.gamepad.index === this.gamepads[i].index) {
        this.gamepads.splice(i, 1)
      }
    }
  }


  buttonHandler = () => {
    const gamepads = navigator.getGamepads() || []
    for (let gamepad of gamepads) {
      let allowed_gamepad = false
      let registered_id = -1
      let registered_index = -1
      for (let i = 0; i < this.gamepads.length; i++) {
        if (gamepad !== null && gamepad.index === this.gamepads[i].index) {
          allowed_gamepad = true
          registered_id = gamepad.index
          registered_index = i
        }
      }

      if (gamepad !== null && allowed_gamepad) {
        let pressedbuttons = "";
        for (let i = 0; i < gamepad.buttons.length; i++)
          if (gamepad.buttons[i] && gamepad.buttons[i].pressed) {
            if (i === this.gamepads[registered_index].buttons.indexOf("A")) {
              pressedbuttons += "A"
            }
            else if (i === this.gamepads[registered_index].buttons.indexOf("B")) {
              pressedbuttons += "B"
            }
            else if (i === this.gamepads[registered_index].buttons.indexOf("U")) {
              pressedbuttons += "U"
            }
            else if (i === this.gamepads[registered_index].buttons.indexOf("D")) {
              pressedbuttons += "D"
            }
            else if (i === this.gamepads[registered_index].buttons.indexOf("L")) {
              pressedbuttons += "L"
            }
            else if (i === this.gamepads[registered_index].buttons.indexOf("R")) {
              pressedbuttons += "R"
            }
          }

        if (this.gamepads[registered_index].lastButtonsStatus !== pressedbuttons) {
          this.gamepads[registered_index].lastButtonsStatus = pressedbuttons
          if (pressedbuttons !== "")
            this.buttonAction(registered_index, pressedbuttons)
        }

      }
    }
    window.requestAnimationFrame(this.buttonHandler)
  }

  buttonAction = (player: number, press: string) => {
    if (press.includes("A") && press.includes("B") && press.includes("D")) {
      location.reload()
    }
    if (press.includes("A")) {
      const i = this.players[player].x
      const j = this.players[player].y
      if (this.grid[i][j] !== Status.FILLED) {
        this.grid[i][j] = Status.FILLED
        this.hints.row[i].isCorrect = this.isLineCorrect('row', i)
        this.hints.column[j].isCorrect = this.isLineCorrect('column', j)
        this.checkSucceed()
      } else {
        this.grid[i][j] = Status.UNSET
      }

    }
    else if (press.includes("B")) {
      const i = this.players[player].x
      const j = this.players[player].y
      if (this.grid[i][j] !== Status.EMPTY) {
        this.grid[i][j] = Status.EMPTY
        this.hints.row[i].isCorrect = this.isLineCorrect('row', i)
        this.hints.column[j].isCorrect = this.isLineCorrect('column', j)
        this.checkSucceed()
      } else {
        this.grid[i][j] = Status.UNSET
      }
    }
    else if (press.includes("U")) {
      this.players[player].x = (this.players[player].x - 1 + this.m) % this.m
    }
    else if (press.includes("D")) {
      this.players[player].x = (this.players[player].x + 1) % this.m
    }
    else if (press.includes("L")) {
      this.players[player].y = (this.players[player].y - 1 + this.n) % this.n
    }
    else if (press.includes("R")) {
      this.players[player].y = (this.players[player].y + 1) % this.n
    }

    for (let i = 0; i < this.players.length; i++) {
      if (i !== player 
                && this.players[i].x === this.players[player].x 
                && this.players[i].y === this.players[player].y)
        this.buttonAction(player, press)
    }

    this.print()
  }

  mousedown = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const d = rect.width * 2 / 3 / (this.n + 1)
    const location = this.getLocation(x, y)
    if (location === 'controller') {
      this.switchBrush()
    } else if (location === 'grid') {
      this.draw.firstI = Math.floor(y / d - 0.5)
      this.draw.firstJ = Math.floor(x / d - 0.5)
      this.draw.inverted = e.button === 2
      const cell = this.grid[this.draw.firstI][this.draw.firstJ]
      let brush = this.brush
      if (this.draw.inverted) {
        brush = this.brush === Status.FILLED ? Status.EMPTY : Status.FILLED
      }
      if (cell === Status.UNSET || brush === cell) {
        this.draw.mode = (brush === cell) ? 'empty' : 'filling'
        this.isPressed = true
        this.switchCell(this.draw.firstI, this.draw.firstJ)
      }
      this.draw.lastI = this.draw.firstI
      this.draw.lastJ = this.draw.firstJ
    }
  }
  mousemove = (e: MouseEvent) => {
    if (this.isPressed) {
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const d = rect.width * 2 / 3 / (this.n + 1)
      if (this.getLocation(x, y) === 'grid') {
        const i = Math.floor(y / d - 0.5)
        const j = Math.floor(x / d - 0.5)
        if (i !== this.draw.lastI || j !== this.draw.lastJ) {
          if (this.draw.direction === undefined) {
            if (i === this.draw.firstI) {
              this.draw.direction = 'row'
            } else if (j === this.draw.firstJ) {
              this.draw.direction = 'column'
            }
          }
          if ((this.draw.direction === 'row' && i === this.draw.firstI) ||
            (this.draw.direction === 'column' && j === this.draw.firstJ)) {
            this.switchCell(i, j)
            this.draw.lastI = i
            this.draw.lastJ = j
          }
        }
      }
    }
  }
  switchBrush() {
    this.brush = (this.brush === Status.EMPTY) ? Status.FILLED : Status.EMPTY
    this.printController()
  }
  brushUp = () => {
    delete this.isPressed
    this.draw = {}
  }
  switchCell(i: number, j: number) {
    let brush = this.brush
    if (this.draw.inverted) {
      brush = this.brush === Status.FILLED ? Status.EMPTY : Status.FILLED
    }
    if (brush === Status.FILLED && this.grid[i][j] !== Status.EMPTY) {
      this.grid[i][j] = (this.draw.mode === 'filling') ? Status.FILLED : Status.UNSET
      this.hints.row[i].isCorrect = this.isLineCorrect('row', i)
      this.hints.column[j].isCorrect = this.isLineCorrect('column', j)
      this.print()
    } else if (brush === Status.EMPTY && this.grid[i][j] !== Status.FILLED) {
      this.grid[i][j] = (this.draw.mode === 'filling') ? Status.EMPTY : Status.UNSET
      this.print()
    }
    this.checkSucceed()
  }

  printGrid() {
    const { ctx } = this
    const { width: w, height: h } = this.canvas
    const d = w * 2 / 3 / (this.n + 1)

    ctx.clearRect(-1, -1, w * 2 / 3 + 1, h * 2 / 3 + 1)
    if (this.theme.isMeshed && !this.theme.isMeshOnTop) {
      this.printMesh()
    }
    ctx.save()
    ctx.translate(d / 2, d / 2)
    for (let i = 0; i < this.m; i += 1) {
      for (let j = 0; j < this.n; j += 1) {
        ctx.save()
        ctx.translate(d * j, d * i)
        let player = -1
        for (let p = 0; p < this.players.length; p++) {
          if (this.players[p].x === i && this.players[p].y === j) {
            player = p
          }
        }
        this.printCell(this.grid[i][j], player)
        ctx.restore()
      }
    }
    ctx.restore()
    if (this.theme.isMeshed && this.theme.isMeshOnTop) {
      this.printMesh()
    }
  }

  printCell(status: Status, player: number) {
    const { ctx } = this
    const d = this.canvas.width * 2 / 3 / (this.n + 1)
    if (player === -1) {
      switch (status) {
        case Status.FILLED:
          ctx.fillStyle = this.theme.filledColor
          ctx.fillRect(-d * 0.05, -d * 0.05, d * 1.1, d * 1.1)
          break
        case Status.EMPTY:
          ctx.strokeStyle = $.red
          ctx.lineWidth = d / 15
          ctx.beginPath()
          ctx.moveTo(d * 0.3, d * 0.3)
          ctx.lineTo(d * 0.7, d * 0.7)
          ctx.moveTo(d * 0.3, d * 0.7)
          ctx.lineTo(d * 0.7, d * 0.3)
          ctx.stroke()
          break
      }
    } else {
      switch (status) {
        case Status.FILLED:
          ctx.fillStyle = this.player_colors[player].filled
          ctx.fillRect(-d * 0.05, -d * 0.05, d * 1.1, d * 1.1)
          break
        case Status.EMPTY:
          ctx.fillStyle = this.player_colors[player].unfilled
          ctx.fillRect(-d * 0.05, -d * 0.05, d * 1.1, d * 1.1)
          ctx.strokeStyle = $.red
          ctx.lineWidth = d / 15
          ctx.beginPath()
          ctx.moveTo(d * 0.3, d * 0.3)
          ctx.lineTo(d * 0.7, d * 0.7)
          ctx.moveTo(d * 0.3, d * 0.7)
          ctx.lineTo(d * 0.7, d * 0.3)
          ctx.stroke()
          break
        default:
          ctx.fillStyle = this.player_colors[player].unfilled
          ctx.fillRect(-d * 0.05, -d * 0.05, d * 1.1, d * 1.1)
          break
      }
    }

  }
  printController() {
    const { ctx } = this
    const { width: w, height: h } = this.canvas
    const controllerSize = Math.min(w, h) / 4
    const outerSize = controllerSize * 3 / 4
    const offset = controllerSize / 4
    const borderWidth = controllerSize / 20
    const innerSize = outerSize - 2 * borderWidth

    function printFillingBrush() {
      ctx.save()
      ctx.translate(offset, 0)
      ctx.fillStyle = this.theme.meshColor
      ctx.fillRect(0, 0, outerSize, outerSize)
      ctx.fillStyle = this.theme.filledColor
      ctx.fillRect(borderWidth, borderWidth, innerSize, innerSize)
      ctx.restore()
    }

    function printEmptyBrush() {
      ctx.save()
      ctx.translate(0, offset)
      ctx.fillStyle = this.theme.meshColor
      ctx.fillRect(0, 0, outerSize, outerSize)
      ctx.clearRect(borderWidth, borderWidth, innerSize, innerSize)
      ctx.strokeStyle = $.red
      ctx.lineWidth = borderWidth
      ctx.beginPath()
      ctx.moveTo(outerSize * 0.3, outerSize * 0.3)
      ctx.lineTo(outerSize * 0.7, outerSize * 0.7)
      ctx.moveTo(outerSize * 0.3, outerSize * 0.7)
      ctx.lineTo(outerSize * 0.7, outerSize * 0.3)
      ctx.stroke()
      ctx.restore()
    }

    ctx.clearRect(w * 2 / 3 - 1, h * 2 / 3 - 1, w / 3 + 1, h / 3 + 1)
    ctx.save()
    ctx.translate(w * 0.7, h * 0.7)
    if (this.brush === Status.FILLED) {
      printEmptyBrush.call(this)
      printFillingBrush.call(this)
    } else if (this.brush === Status.EMPTY) {
      printFillingBrush.call(this)
      printEmptyBrush.call(this)
    }
    ctx.restore()
  }

  checkSucceed() {
    const correct = this.hints.row.every(singleRow => !!singleRow.isCorrect) &&
      this.hints.column.every(singleCol => !!singleCol.isCorrect)
    if (correct) {
      this.succeed()
    }
  }

  succeed() {
    this.handleSuccess()
    this.listeners.forEach(([type, listener]) => {
      this.canvas.removeEventListener(type, listener)
    })
    const { ctx } = this
    const { width: w, height: h } = this.canvas
    const controllerSize = Math.min(w, h) / 4
    const background = ctx.getImageData(0, 0, w, h)

    function getTick() {
      const size = controllerSize * 2
      const borderWidth = size / 10
      const tick = document.createElement('canvas')
      tick.width = size
      tick.height = size

      const c = tick.getContext('2d') || new CanvasRenderingContext2D()
      c.translate(size / 3, size * 5 / 6)
      c.rotate(-Math.PI / 4)
      c.fillStyle = $.green
      c.fillRect(0, 0, borderWidth, -size * Math.SQRT2 / 3)
      c.fillRect(0, 0, size * Math.SQRT2 * 2 / 3, -borderWidth)

      return tick
    }

    const tick = getTick()
    let t = 0

    function f(_: number) {
      return 1 + Math.pow(_ - 1, 3)
    }

    const fadeTickIn = () => {
      ctx.putImageData(background, 0, 0)
      t += 0.03
      ctx.globalAlpha = f(t)
      ctx.clearRect(w * 2 / 3, h * 2 / 3, w / 3, h / 3)
      ctx.drawImage(tick,
        w * 0.7 - (1 - f(t)) * controllerSize / 2,
        h * 0.7 - (1 - f(t)) * controllerSize / 2,
        (2 - f(t)) * controllerSize,
        (2 - f(t)) * controllerSize)
      if (t <= 1) {
        requestAnimationFrame(fadeTickIn)
      } else {
        this.handleAnimationEnd()
      }
    }

    fadeTickIn()
  }
}
