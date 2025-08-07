import Foundation
import SwiftSoup

// Direct port from PasteManager.swift
class TableFormatter {
    var usePrefixEnabled: Bool = true
    var userDefinedPrefix: String = "Below is a table. The symbol \"|\" denotes a separation in a column: "
    
    // Port of convertHTMLToPlainText from PasteManager.swift
    func convertHTMLToPlainText(_ html: String) throws -> String {
        let document = try SwiftSoup.parse(html)
        guard let body = document.body() else { 
            return "" 
        }
        
        var result = ""
        
        for element in body.children() {
            if element.tagName() == "table" {
                if usePrefixEnabled {
                    var prefix = userDefinedPrefix.isEmpty
                        ? "Below is a table. The symbol \"|\" denotes a separation in a column: "
                        : userDefinedPrefix
                    prefix += "\n\n"
                    result += prefix
                }
                
                let rows = try element.select("tr")
                for row in rows {
                    let cells = try row.select("td, th")
                    var formattedRow = "| "
                    
                    for (index, cell) in cells.enumerated() {
                        let cellText = try cell.text()
                        formattedRow += (index > 0 ? " | " : "") + cellText
                    }
                    
                    result += formattedRow + " |\n"
                }
            } else if element.tagName() == "google-sheets-html-origin" {
                // Special handling for Google Sheets
                if let table = try element.select("table").first() {
                    if usePrefixEnabled {
                        var prefix = userDefinedPrefix.isEmpty
                            ? "Below is a table. The symbol \"|\" denotes a separation in a column: "
                            : userDefinedPrefix
                        prefix += "\n\n"
                        result += prefix
                    }
                    
                    let rows = try table.select("tr")
                    for row in rows {
                        let cells = try row.select("td, th")
                        var formattedRow = "| "
                        
                        for (index, cell) in cells.enumerated() {
                            let cellText = try cell.text()
                            formattedRow += (index > 0 ? " | " : "") + cellText
                        }
                        
                        result += formattedRow + " |\n"
                    }
                }
            } else {
                // Append non-table text content as plain text
                result += try element.text() + "\n\n"
            }
        }
        
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    // Port of detectDelimiter from PasteManager.swift
    func detectDelimiter(in text: String) -> String {
        let delimiters = ["\t"]  // Original only checks for tab
        var delimiterCounts: [String: Int] = [:]
        
        if let firstLine = text.components(separatedBy: CharacterSet.newlines).first(where: { !$0.isEmpty }) {
            for delimiter in delimiters {
                let count = firstLine.components(separatedBy: delimiter).count - 1
                delimiterCounts[delimiter] = count
            }
        }
        
        return delimiterCounts.max(by: { $0.value < $1.value })?.key ?? "\t"
    }
    
    // Port of splitRow from PasteManager.swift
    func splitRow(_ row: String, delimiter: String) -> [String] {
        var columns: [String] = []
        var currentColumn = ""
        var inQuotes = false
        var index = row.startIndex
        
        while index < row.endIndex {
            let char = row[index]
            if char == "\"" {
                inQuotes.toggle()
                currentColumn.append(char)
            } else if String(char) == delimiter && !inQuotes {
                columns.append(currentColumn)
                currentColumn = ""
            } else {
                currentColumn.append(char)
            }
            index = row.index(after: index)
        }
        columns.append(currentColumn)
        
        return columns.map {
            var cell = $0.trimmingCharacters(in: .whitespacesAndNewlines)
            if cell.hasPrefix("\"") && cell.hasSuffix("\"") {
                cell = String(cell.dropFirst().dropLast())
            }
            return cell.replacingOccurrences(of: "\n", with: " ")
        }
    }
    
    // Port of convertToFormattedTable from PasteManager.swift
    func convertToFormattedTable(text: String, format: FormatType) -> String {
        // Normalize line endings
        let normalizedText = text
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        
        // Detect delimiter
        let delimiter = detectDelimiter(in: normalizedText)
        
        let rows = normalizedText
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        
        var tableData: [[String]] = []
        
        for row in rows {
            let columns = splitRow(row, delimiter: delimiter)
            tableData.append(columns)
        }
        
        let numColumns = tableData.map { $0.count }.max() ?? 0
        var columnWidths = [Int](repeating: 0, count: numColumns)
        
        for row in tableData {
            for (index, cell) in row.enumerated() {
                let cellWidth = cell.count
                if cellWidth > columnWidths[index] {
                    columnWidths[index] = cellWidth
                }
            }
        }
        
        var result = ""
        
        switch format {
        case .PLAIN_TEXT:
            for row in tableData {
                var line = "|"
                for i in 0..<numColumns {
                    let cell = i < row.count ? row[i] : ""
                    let paddedCell = " " + cell + " "
                    line += paddedCell + "|"
                }
                result += line + "\n"
            }
            
        case .PRETTIFIED_PLAIN_TEXT:
            let topBorder = createBorderLine(columnWidths: columnWidths)
            result += topBorder + "\n"
            
            for (rowIndex, row) in tableData.enumerated() {
                var line = "|"
                for i in 0..<numColumns {
                    let cell = i < row.count ? row[i] : ""
                    let paddedCell = " " + cell.padding(toLength: columnWidths[i], withPad: " ", startingAt: 0) + " "
                    line += paddedCell + "|"
                }
                result += line + "\n"
                
                if rowIndex == 0 {
                    // Insert separator after header row
                    let separatorLine = createBorderLine(columnWidths: columnWidths)
                    result += separatorLine + "\n"
                }
            }
            let bottomBorder = createBorderLine(columnWidths: columnWidths)
            result += bottomBorder
            
        case .HTML:
            result += "<table>\n"
            for (rowIndex, row) in tableData.enumerated() {
                result += "  <tr>\n"
                for cell in row {
                    let tag = rowIndex == 0 ? "th" : "td"
                    result += "    <\(tag)>\(cell)</\(tag)>\n"
                }
                result += "  </tr>\n"
            }
            result += "</table>"
            
        case .MARKDOWN:
            for (rowIndex, row) in tableData.enumerated() {
                result += "| " + row.joined(separator: " | ") + " |\n"
                if rowIndex == 0 {
                    result += "| " + columnWidths.map { String(repeating: "-", count: $0) }.joined(separator: " | ") + " |\n"
                }
            }
        }
        
        return result
    }
    
    private func createBorderLine(columnWidths: [Int], separator: String = "+", filler: String = "-") -> String {
        var line = separator
        for width in columnWidths {
            line += String(repeating: filler, count: width + 2) + separator
        }
        return line
    }
    
    // Main entry point that combines everything
    func createPasteableContent(_ content: String, isHTML: Bool = false, outputFormat: String = "simple") -> String {
        var modifiedContent: String
        
        if isHTML {
            // Process as HTML
            do {
                return try convertHTMLToPlainText(content)
            } catch {
                // Fall back to plain text processing if HTML parsing fails
                print("HTML parsing failed: \(error)")
            }
        }
        
        // Process as plain text with delimiter detection
        var prefix = ""
        if usePrefixEnabled {
            prefix = userDefinedPrefix.isEmpty
                ? "Below is a table. The symbol \"|\" denotes a separation in a column: "
                : userDefinedPrefix
            prefix += "\n\n"
        }
        
        let format: FormatType
        switch outputFormat {
        case "pretty-printed":
            format = .PRETTIFIED_PLAIN_TEXT
        case "html":
            format = .HTML
        case "markdown":
            format = .MARKDOWN
        default:
            format = .PLAIN_TEXT
        }
        
        modifiedContent = convertToFormattedTable(text: content, format: format)
        return prefix + modifiedContent
    }
}

// Exact enum from original
enum FormatType {
    case PLAIN_TEXT
    case PRETTIFIED_PLAIN_TEXT
    case HTML
    case MARKDOWN
}